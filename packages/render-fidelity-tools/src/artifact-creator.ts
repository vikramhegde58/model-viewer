/* @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {promises as fs} from 'fs';
import mkdirp from 'mkdirp';
import {join, resolve} from 'path';
import pngjs from 'pngjs';
import puppeteer from 'puppeteer';

import {Dimensions, GoldenConfig, ImageComparator, ImageComparisonAnalysis, ImageComparisonConfig, ScenarioConfig} from './common.js';
import {ConfigReader} from './config-reader.js';

const $configReader = Symbol('configReader');

export type AnalysisResults = Array<Array<ImageComparisonAnalysis>>;

export interface ScenarioRecord extends ScenarioConfig {
  analysisResults: AnalysisResults;
}

export class ArtifactCreator {
  private[$configReader]: ConfigReader = new ConfigReader(this.config);

  constructor(
      protected config: ImageComparisonConfig, protected rootDirectory: string,
      protected baseUrl: string) {
    console.log('🌈 Preparing to capture screenshots for fidelity comparison');
  }

  protected get outputDirectory(): string {
    return join(resolve(this.rootDirectory), 'results');
  }

  protected get goldens(): Array<GoldenConfig> {
    return this.config.renderers.map(
        renderer => ({...renderer, file: `${renderer.name}-golden.png`}));
  }

  async captureAndAnalyzeScreenshots(
      scenarioWhitelist: Set<string>|null = null) {
    const {scenarios, analysisThresholds} = this.config;
    const analyzedScenarios: Array<ScenarioConfig> = [];
    const {goldens, outputDirectory} = this;

    for (const scenarioBase of scenarios) {
      const scenarioName = scenarioBase.name;
      const scenario = this[$configReader].scenarioConfig(scenarioName)!;
      const {dimensions} = scenario;

      if (scenarioWhitelist != null && !scenarioWhitelist.has(scenarioName)) {
        continue;
      }

      console.log(`\n🎨 Scenario: ${scenarioName}`);

      const scenarioOutputDirectory = join(outputDirectory, scenarioName);

      mkdirp.sync(scenarioOutputDirectory);

      const screenshot = await this.captureScreenshot(
          'model-viewer',
          scenarioName,
          dimensions,
          join(scenarioOutputDirectory, 'model-viewer.png'));

      if (screenshot == null) {
        console.log(`🚨 Failed to capture screenshot`);
        continue;
      }

      const analysisResults = await this.analyze(
          screenshot, goldens, scenario, dimensions, analysisThresholds);

      const scenarioRecord = {analysisResults, scenario};

      console.log(`\n💾 Recording analysis`);

      await fs.writeFile(
          join(outputDirectory, scenarioName, 'analysis.json'),
          JSON.stringify(scenarioRecord));

      analyzedScenarios.push(scenario);
    }

    console.log('💾 Recording configuration');

    const finalConfig: ImageComparisonConfig =
        Object.assign({}, this.config, {scenarios: analyzedScenarios});

    await fs.writeFile(
        join(outputDirectory, 'config.json'), JSON.stringify(finalConfig));

    return scenarios;
  }

  protected async analyze(
      screenshot: Buffer, goldens: Array<GoldenConfig>,
      scenario: ScenarioConfig, dimensions: Dimensions,
      analysisThresholds: Array<number>): Promise<AnalysisResults> {
    const analysisResults: AnalysisResults = [];
    const {rootDirectory, outputDirectory} = this;
    const {name: scenarioName, exclude} = scenario;

    for (const goldenConfig of goldens) {
      const {name: rendererName} = goldenConfig;

      if (exclude != null && exclude.includes(rendererName)) {
        continue;
      }

      console.log(
          `\n🔍 Comparing <model-viewer> to ${goldenConfig.description}`);

      const thresholdResults: Array<ImageComparisonAnalysis> = [];
      const goldenPath =
          join(rootDirectory, 'goldens', scenarioName, goldenConfig.file)
      const golden = await fs.readFile(goldenPath);

      const screenshotImage = pngjs.PNG.sync.read(screenshot).data;
      const goldenImage = pngjs.PNG.sync.read(golden).data;

      const comparator =
          new ImageComparator(screenshotImage, goldenImage, dimensions);

      await fs.writeFile(
          join(outputDirectory, scenarioName, goldenConfig.file), golden);

      for (const threshold of analysisThresholds) {
        console.log(`\n  📏 Using threshold ${threshold.toFixed(1)}`);
        const {analysis} = comparator.analyze(threshold);
        const {
          matchingRatio,
          averageDistanceRatio,
          mismatchingAverageDistanceRatio
        } = analysis;

        thresholdResults.push(analysis);

        console.log(
            `  📊 Matching pixels: ${(matchingRatio * 100).toFixed(2)}%`);
        console.log(`  📊 Mean color distance: ${
            (averageDistanceRatio * 100).toFixed(2)}%`);
        console.log(`  📊 Mean color distance (mismatching pixels only): ${
            (mismatchingAverageDistanceRatio * 100).toFixed(2)}%`);
      }

      const {rmsDistanceRatio} = thresholdResults[0];
      console.log(
          `\n  📊 Decibels of root mean square color distance (without threshold): ${
              (10 * Math.log10(rmsDistanceRatio)).toFixed(2)}`);

      analysisResults.push(thresholdResults);
    }

    return analysisResults;
  }

  async captureScreenshot(
      renderer: string, scenarioName: string, dimensions: Dimensions,
      outputPath: string = join(this.outputDirectory, 'model-viewer.png')) {
    const devicePixelRatio = 2;
    const scaledWidth = dimensions.width;
    const scaledHeight = dimensions.height;
    const rendererConfig = this[$configReader].rendererConfig(renderer);

    if (rendererConfig == null) {
      console.log(`⚠️ Renderer "${
          renderer}" is not configured. Did you add it to the test config?`);
      return;
    }

    console.log(`🚀 Launching browser`);

    const browser = await puppeteer.launch({
      defaultViewport: {
        width: scaledWidth,
        height: scaledHeight,
        deviceScaleFactor: devicePixelRatio
      },
      headless: false
    });

    const page = await browser.newPage();
    const url = `${this.baseUrl}?hide-ui&config=../../config.json&scenario=${
        encodeURIComponent(scenarioName)}`;

    page.on('error', (error: any) => {
      console.log(`🚨 ${error}`);
    });

    page.on('console', async (message: any) => {
      const args =
          await Promise.all(message.args().map((arg: any) => arg.jsonValue()));

      if (args.length) {
        console.log(`➡️`, ...args);
      }
    });

    console.log(`🗺  Navigating to ${url}`);

    await page.goto(url);

    console.log(
        `🖌  Rendering ${scenarioName} with ${rendererConfig.description}`);

    // NOTE: The function passed to page.evaluate is stringified and eval'd
    // in a browser context. Importantly, this implies that no external
    // variables are captured in its closure scope. TypeScript compiler
    // currently has no mechanism to detect this and will happily tell you
    // your code is correct when it isn't.
    await page.evaluate(async () => {
      const modelBecomesReady = (self as any).modelLoaded ?
          Promise.resolve() :
          new Promise((resolve) => {
            // const timeout = setTimeout(reject, 60000);

            self.addEventListener('model-ready', () => {
              // clearTimeout(timeout);
              resolve();
            }, {once: true});
          });

      await modelBecomesReady;
    });

    console.log(`🖼  Capturing screenshot`);

    try {
      await fs.mkdir(this.outputDirectory);
    } catch (e) {
      // Ignored...
    }

    const screenshot = await page.screenshot({path: outputPath});

    await browser.close();

    return screenshot;
  }
}
