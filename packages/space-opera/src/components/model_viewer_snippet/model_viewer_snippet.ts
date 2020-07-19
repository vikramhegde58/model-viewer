/**
 * @license
 * Copyright 2020 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import '@material/mwc-button';
import '../open_button/open_button.js';
import '../download_button/download_button.js';
import '../shared/snippet_viewer/snippet_viewer.js';
import '../shared/expandable_content/expandable_tab.js';

import {ModelViewerConfig, parseSnippet} from '@google/model-viewer-editing-adapter/lib/main.js'
import {isObjectUrl} from '@google/model-viewer-editing-adapter/lib/util/create_object_url.js';
import {css, customElement, html, internalProperty, LitElement, query} from 'lit-element';

import {applyCameraEdits, Camera, INITIAL_CAMERA} from '../../redux/camera_state.js';
import {HotspotConfig} from '../../redux/hotspot_config.js';
import {dispatchSetHotspots} from '../../redux/hotspot_dispatchers.js';
import {parseHotspotsFromSnippet} from '../../redux/parse_hotspot_config.js';
import {dispatchConfig, dispatchGltfUrl, State} from '../../redux/space_opera_base.js';
import {ConnectedLitElement} from '../connected_lit_element/connected_lit_element.js';
import {ExportZipButton} from '../download_button/download_button.js';
import {SnippetViewer} from '../shared/snippet_viewer/snippet_viewer.js';
import {styles as hotspotStyles} from '../utils/hotspot/hotspot.css.js';
import {renderHotspots} from '../utils/hotspot/render_hotspots.js';
import {renderModelViewer} from '../utils/render_model_viewer.js';

/**
 *
 */
@customElement('me-export-panel')
export class ExportPanel extends ConnectedLitElement {
  @internalProperty() config: ModelViewerConfig = {};
  @internalProperty() hotspots: HotspotConfig[] = [];
  @internalProperty() camera: Camera = INITIAL_CAMERA;
  @internalProperty() gltfUrl?: string;

  @query('snippet-viewer') snippetViewer!: SnippetViewer;
  @query('me-export-zip-button') exportZipButton!: ExportZipButton;

  stateChanged(state: State) {
    this.config = state.config;
    this.camera = state.camera;
    this.hotspots = state.hotspots;
    this.gltfUrl = state.gltfUrl;
  }

  render() {
    const editedConfig = {...this.config};
    applyCameraEdits(editedConfig, this.camera);

    // If the last loaded URL is not an object URL, echo it here for
    // convenience.
    if (this.gltfUrl && !isObjectUrl(this.gltfUrl)) {
      editedConfig.src = this.gltfUrl;
    } else {
      // Uploaded GLB
      editedConfig.src = `Change this to your GLB URL`;
    }

    if (editedConfig.environmentImage &&
        isObjectUrl(editedConfig.environmentImage)) {
      // Uploaded env image
      editedConfig.environmentImage = `Change this to your HDR URL`;
    }

    if (editedConfig.poster && isObjectUrl(editedConfig.poster)) {
      editedConfig.poster = `Change this to your poster URL`;
    }

    const snippet =
        renderModelViewer(editedConfig, {}, renderHotspots(this.hotspots));

    return html`
    <me-expandable-tab tabName="Export" .open=${true}>
    <div slot="content">
      <me-download-button id="download-gltf"></me-download-button>
      <me-export-zip-button id="export-zip"></me-export-zip-button><br/>
      <br/>
      And use this model-viewer snippet:<br/>
      <br/>
      <snippet-viewer .renderedSnippet=${snippet}
        .renderedStyle=${this.hotspots.length > 0 ? hotspotStyles.cssText : ``}>
      </snippet-viewer>
    </div>
    </me-expandable-tab>`;
  }

  protected updated() {
    this.snippetViewer.updateComplete.then(() => {
      this.exportZipButton.snippetText =
          this.snippetViewer.snippet.textContent || '';
    });
  }
}

/**
 * Import/Export panel.
 * TODO:: This should be factored out/renamed.
 */
@customElement('model-viewer-snippet')
export class ModelViewerSnippet extends LitElement {
  static get styles() {
    return css`
  #mv-input {
    width: 95%;
  }
        `;
  }

  @query('textarea#mv-input') private readonly textArea!: HTMLInputElement;

  @internalProperty() errors: string[] = [];

  async handleSubmitSnippet(event: Event) {
    event.preventDefault();
    if (!this.textArea)
      return;
    this.errors = [];
    const inputText: string = this.textArea.value.trim();
    if (inputText.match(
            /<\s*model-viewer[^>]*\s*>(\n|.)*<\s*\/\s*model-viewer>/)) {
      const config = parseSnippet(inputText);

      const hotspotErrors: Error[] = [];
      const hotspotConfigs = parseHotspotsFromSnippet(inputText, hotspotErrors);
      for (const error of hotspotErrors) {
        this.errors.push(error.message);
      }

      try {
        // If we can't fetch the snippet's src, don't even bother using it.
        // But still dispatch the config, hotspots, etc.
        if (config.src && (await fetch(config.src)).ok) {
          dispatchGltfUrl(undefined);
          // Because of update-batching, we need to sleep first to force reload.
          await new Promise(resolve => {
            setTimeout(resolve, 0);
          });
          dispatchGltfUrl(config.src);
        }

        // NOTE: It's important to dispatch these *after* the URL dispatches. If
        // we dispatch the config and THEN clear the model URL, then
        // config.animationName is cleared too (animation UI tries to find the
        // anim by name, can't find it because the model is empty, thus
        // triggering a change event selecting none).
        dispatchConfig(config);
        dispatchSetHotspots(hotspotConfigs);
      } catch (e) {
        console.log(
            `Could not download 'src' attribute - OK, ignoring it. Error: ${
                e.message}`);
      }
    } else {
      this.errors = ['Could not find "model-viewer" tag in snippet'];
    }
  }

  render() {
    const exampleLoadableSnippet = `<model-viewer
  src='https://modelviewer.dev/shared-assets/models/RobotExpressive.glb'
  autoplay animation-name="Wave"
  shadow-intensity="0.5">
</model-viewer>`;

    return html`
    <me-expandable-tab tabName="Import" .open=${true}>
    <div slot="content">
      <me-open-button></me-open-button><br/>
      <br/>
      Or load a model-viewer snippet:<br/>
      <br/>
      <textarea id="mv-input" rows=10
        >${exampleLoadableSnippet}</textarea>
      ${this.errors.map(error => html`<div>${error}</div>`)}
      <mwc-button unelevated icon="folder_open"
        @click=${this.handleSubmitSnippet}
        >Import snippet</mwc-button>
    </div>
    </me-expandable-tab>

    <me-export-panel></me-export-panel>
            `;
  }

  updated() {
    // Work-around closureZ issue.
    this.textArea.style.backgroundColor =
        this.errors.length > 0 ? 'pink' : 'white';
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'model-viewer-snippet': ModelViewerSnippet;
    'me-export-panel': ExportPanel;
  }
}
