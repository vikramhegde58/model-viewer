/* @license
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
 */

import {RGBA} from '../api.js';
import {FakeModelKernel} from '../test-helpers.js';

import {PBRMetallicRoughness} from './pbr-metallic-roughness.js';

suite('api/pbr-metallic-roughness', () => {
  suite('definePBRMetallicRoughness', () => {
    test('yields a valid constructor', () => {
      const instance = new PBRMetallicRoughness(new FakeModelKernel(), {
        id: 0,
        baseColorFactor: [0, 0, 0, 1],
        metallicFactor: 0,
        roughnessFactor: 0
      });

      expect(instance).to.be.ok;
    });

    test('produces elements with the correct owner model', () => {
      const kernel = new FakeModelKernel();
      const instance = new PBRMetallicRoughness(kernel, {
        id: 0,
        baseColorFactor: [0, 0, 0, 1],
        metallicFactor: 0,
        roughnessFactor: 0
      });

      expect(instance.ownerModel).to.be.equal(kernel.model);
    });

    suite('PBRMetallicRoughness', () => {
      test('is configured with the serialized material parameters', () => {
        const baseColorFactor: RGBA =
            [Math.random(), Math.random(), Math.random(), Math.random()];
        const metallicFactor: number = Math.random();
        const roughnessFactor: number = Math.random();

        const instance = new PBRMetallicRoughness(
            new FakeModelKernel(),
            {id: 0, baseColorFactor, metallicFactor, roughnessFactor});

        expect(instance.baseColorFactor).to.be.deep.equal(baseColorFactor);
        expect(instance.metallicFactor).to.be.equal(metallicFactor);
        expect(instance.roughnessFactor).to.be.equal(roughnessFactor);
      });
    });
  });
});
