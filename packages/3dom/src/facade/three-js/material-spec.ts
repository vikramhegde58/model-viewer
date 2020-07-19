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

import {MeshStandardMaterial} from 'three/src/materials/MeshStandardMaterial.js';
import {Color} from 'three/src/math/Color.js';

import {Material as GLTFMaterial} from '../../gltf-2.0.js';
import {createFakeThreeGLTF} from '../../test-helpers.js';

import {CorrelatedSceneGraph} from './correlated-scene-graph.js';
import {Material} from './material.js';
import {ModelGraft} from './model-graft.js';
import {PBRMetallicRoughness} from './pbr-metallic-roughness.js';

suite('facade/three-js/material', () => {
  suite('Material', () => {
    test(
        'expresses Three.js material color as PBRMetallicRoughness base color factor',
        async () => {
          const graft = new ModelGraft(
              '', CorrelatedSceneGraph.from(createFakeThreeGLTF()));
          const gltfMaterial: GLTFMaterial = {
            pbrMetallicRoughness: {baseColorFactor: [1, 0.5, 0, 1]}
          };

          const threeMaterial = new MeshStandardMaterial();
          threeMaterial.color = new Color('rgb(255, 127, 0)');

          const material =
              new Material(graft, gltfMaterial, new Set([threeMaterial]));
          const {pbrMetallicRoughness} = material;


          expect(pbrMetallicRoughness).to.be.ok;
          expect((pbrMetallicRoughness as PBRMetallicRoughness).baseColorFactor)
              .to.be.deep.equal([1, 0.5, 0, 1]);
        });
  });
});
