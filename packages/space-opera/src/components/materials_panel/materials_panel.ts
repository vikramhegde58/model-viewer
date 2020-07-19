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

import '../shared/checkbox/checkbox.js';
import '../shared/color_picker/color_picker.js';
import '../shared/dropdown/dropdown.js';
import '../shared/editor_panel/editor_panel.js';
import '../shared/expandable_content/expandable_tab.js';
import '../shared/section_row/section_row.js';
import '../shared/slider_with_input/slider_with_input.js';
import '../shared/texture_picker/texture_picker.js';
import '@polymer/paper-item';
import '@polymer/paper-slider';
import '@material/mwc-icon-button';

import {ALPHA_BLEND_MODES, checkFinite, DEFAULT_EMISSIVE_FACTOR, RGB, RGBA} from '@google/model-viewer-editing-adapter/lib/main.js'
import {createSafeObjectUrlFromUnsafe, SafeObjectUrl} from '@google/model-viewer-editing-adapter/lib/util/create_object_url.js'
import {customElement, html, internalProperty, property, query} from 'lit-element';
import * as color from 'ts-closure-library/lib/color/color';  // from //third_party/javascript/closure/color

import {dispatchAddBaseColorTexture, dispatchAddEmissiveTexture, dispatchAddMetallicRoughnessTexture, dispatchAddNormalTexture, dispatchAddOcclusionTexture, dispatchBaseColorTexture, dispatchDoubleSided, dispatchEmissiveTexture, dispatchMaterialBaseColor, dispatchMetallicFactor, dispatchMetallicRoughnessTexture, dispatchNormalTexture, dispatchOcclusionTexture, dispatchRoughnessFactor, dispatchSetAlphaCutoff, dispatchSetAlphaMode, dispatchSetEmissiveFactor} from '../../redux/edit_dispatchers.js';
import {TexturesById} from '../../redux/material_state.js';
import {Material} from '../../redux/material_state.js';
import {State} from '../../redux/space_opera_base.js';
import {ConnectedLitElement} from '../connected_lit_element/connected_lit_element.js';
import {ColorPicker} from '../shared/color_picker/color_picker.js';
import {Dropdown} from '../shared/dropdown/dropdown.js';
import {SliderWithInputElement} from '../shared/slider_with_input/slider_with_input.js';
import {TexturePicker} from '../shared/texture_picker/texture_picker.js';

import {styles} from './materials_panel.css.js';

/** Material panel. */
@customElement('me-materials-panel')
export class MaterialPanel extends ConnectedLitElement {
  static styles = styles;

  @property({type: Number}) selectedMaterialId?: number;

  @internalProperty() materials: Material[] = [];
  @internalProperty() originalMaterials: Material[] = [];
  @internalProperty() texturesById?: TexturesById;

  @query('me-color-picker#base-color-picker') baseColorPicker!: ColorPicker;
  @query('me-slider-with-input#roughness-factor')
  roughnessFactorSlider!: SliderWithInputElement;
  @query('me-slider-with-input#metallic-factor')
  metallicFactorSlider!: SliderWithInputElement;
  @query('me-dropdown#material-selector') materialSelector?: Dropdown;
  @query('me-texture-picker#base-color-texture-picker')
  baseColorTexturePicker?: TexturePicker;
  @query('me-texture-picker#metallic-roughness-texture-picker')
  metallicRoughnessTexturePicker?: TexturePicker;
  @query('me-texture-picker#normal-texture-picker')
  normalTexturePicker?: TexturePicker;
  @query('me-color-picker#emissive-factor-picker')
  emissiveFactorPicker!: ColorPicker;
  @query('me-texture-picker#emissive-texture-picker')
  emissiveTexturePicker?: TexturePicker;
  @query('me-texture-picker#occlusion-texture-picker')
  occlusionTexturePicker?: TexturePicker;
  @query('me-dropdown#alpha-mode-picker') alphaModePicker?: Dropdown;
  @query('me-slider-with-input#alpha-cutoff')
  alphaCutoffSlider?: SliderWithInputElement;

  private safeTextureUrls: SafeObjectUrl[] = [];
  private safeUrlIds: string[] = [];
  private safeTextureUrlsDirty = false;

  stateChanged(state: State) {
    this.materials = state.edits.materials;
    this.originalMaterials = state.origEdits.materials;

    if (this.selectedMaterialId !== undefined) {
      const id = this.selectedMaterialId;
      if (id < 0 || id >= this.materials.length) {
        this.selectedMaterialId = 0;
      }
    }

    if (this.texturesById !== state.edits.texturesById) {
      this.texturesById = state.edits.texturesById;
      this.safeTextureUrlsDirty = true;
    }
  }

  async performUpdate() {
    if (this.safeTextureUrlsDirty) {
      // Clear this *before* the async call, in case someone else sets it again.
      this.safeTextureUrlsDirty = false;
      await this.updateTextureUrls();
    }
    await super.performUpdate();
  }

  private async updateTextureUrls() {
    // Work with local variables to avoid possible race conditions.
    const newUrls: SafeObjectUrl[] = [];
    const safeUrlIds: string[] = [];
    if (this.texturesById) {
      for (const [id, texture] of this.texturesById) {
        const newUrl = await createSafeObjectUrlFromUnsafe(texture.uri);
        newUrls.push(newUrl);
        safeUrlIds.push(id);
      }
    }
    this.safeTextureUrls = newUrls;
    this.safeUrlIds = safeUrlIds;
  }


  onSelectMaterial() {
    const value = this.materialSelector?.selectedItem?.getAttribute('value');
    if (value !== undefined) {
      this.selectedMaterialId = Number(value);
      checkFinite(this.selectedMaterialId);
    }
  }

  renderSelectMaterialTab() {
    return html`
    <me-expandable-tab tabName="Selected Material" .open=${true}>
      <me-dropdown
        .selectedIndex=${this.selectedMaterialId || 0}
        slot="content"
        id="material-selector"
        @select=${this.onSelectMaterial}
        >${
        this.materials.map(
            (material, id) => html`<paper-item value="${id}">(${id}) ${
                material.name}</paper-item>`)}
      </me-dropdown>
    </me-expandable-tab>
    `;
  }

  get safeSelectedMaterialId() {
    if (this.selectedMaterialId === undefined) {
      throw new Error('No material selected');
    }
    return this.selectedMaterialId;
  }

  get selectedBaseColor(): RGBA {
    const id = this.selectedMaterialId;
    if (id === undefined) {
      throw new Error('No material selected');
    }
    const alphaFactor = this.materials[id].baseColorFactor[3];
    const selectedColor = color.hexToRgb(this.baseColorPicker.selectedColorHex);
    // color.hexToRgb returns RGB vals from 0-255, but glTF expects a val from
    // 0-1.
    return [
      selectedColor[0] / 255,
      selectedColor[1] / 255,
      selectedColor[2] / 255,
      alphaFactor
    ];
  }

  get selectedEmissiveFactor(): RGB {
    const id = this.selectedMaterialId;
    if (id === undefined) {
      throw new Error('No material selected');
    }
    const selectedColor =
        color.hexToRgb(this.emissiveFactorPicker.selectedColorHex);
    // color.hexToRgb returns RGB vals from 0-255, but glTF expects a val from
    // 0-1.
    return [
      selectedColor[0] / 255,
      selectedColor[1] / 255,
      selectedColor[2] / 255
    ];
  }

  get selectedRoughnessFactor(): number {
    return checkFinite(Number(this.roughnessFactorSlider.value));
  }

  get selectedMetallicFactor(): number {
    return checkFinite(Number(this.metallicFactorSlider.value));
  }

  get selectedAlphaCutoff(): number {
    if (!this.alphaCutoffSlider) {
      throw new Error('Alpha cutoff slider doesn\'t exist.');
    }
    return checkFinite(Number(this.alphaCutoffSlider.value));
  }

  onBaseColorChange() {
    if (this.selectedMaterialId === undefined) {
      throw new Error('No material selected');
    }
    const index = this.selectedMaterialId;
    const baseColorFactor = this.selectedBaseColor;
    dispatchMaterialBaseColor({index, baseColorFactor});
  }

  onRoughnessChange() {
    if (this.selectedMaterialId === undefined) {
      throw new Error('No material selected');
    }
    const id = this.selectedMaterialId;
    const roughnessFactor = this.selectedRoughnessFactor;
    dispatchRoughnessFactor({id, roughnessFactor});
  }

  onMetallicChange() {
    if (this.selectedMaterialId === undefined) {
      throw new Error('No material selected');
    }
    const id = this.selectedMaterialId;
    const metallicFactor = this.selectedMetallicFactor;
    dispatchMetallicFactor({id, metallicFactor});
  }

  onDoubleSidedChange(event: Event) {
    if (this.selectedMaterialId === undefined) {
      throw new Error('No material selected');
    }
    const id = this.selectedMaterialId;
    const doubleSided = (event.target as HTMLInputElement).checked;
    dispatchDoubleSided({id, doubleSided});
  }

  get selectedBaseColorTextureId(): string|undefined {
    if (!this.baseColorTexturePicker) {
      throw new Error('Texture picker is not defined');
    }
    if (this.baseColorTexturePicker.selectedIndex === undefined) {
      return undefined;
    }
    return this.safeUrlIds[this.baseColorTexturePicker.selectedIndex];
  }

  get selectedMetallicRoughnessTextureId(): string|undefined {
    if (!this.metallicRoughnessTexturePicker) {
      throw new Error('Texture picker is not defined');
    }
    if (this.metallicRoughnessTexturePicker.selectedIndex === undefined) {
      return undefined;
    }
    return this.safeUrlIds[this.metallicRoughnessTexturePicker.selectedIndex];
  }

  get selectedNormalTextureId(): string|undefined {
    if (!this.normalTexturePicker) {
      throw new Error('Texture picker is not defined');
    }
    if (this.normalTexturePicker.selectedIndex === undefined) {
      return undefined;
    }
    return this.safeUrlIds[this.normalTexturePicker.selectedIndex];
  }

  get selectedEmissiveTextureId(): string|undefined {
    if (!this.emissiveTexturePicker) {
      throw new Error('Texture picker is not defined');
    }
    if (this.emissiveTexturePicker.selectedIndex === undefined) {
      return undefined;
    }
    return this.safeUrlIds[this.emissiveTexturePicker.selectedIndex];
  }

  get selectedOcclusionTextureId(): string|undefined {
    if (!this.occlusionTexturePicker) {
      throw new Error('Texture picker is not defined');
    }
    if (this.occlusionTexturePicker.selectedIndex === undefined) {
      return undefined;
    }
    return this.safeUrlIds[this.occlusionTexturePicker.selectedIndex];
  }

  onBaseColorTextureChange() {
    if (this.selectedMaterialId === undefined) {
      throw new Error('No material selected');
    }
    const id = this.selectedMaterialId;
    const textureId = this.selectedBaseColorTextureId;
    dispatchBaseColorTexture({id, textureId});
  }

  onBaseColorTextureUpload(event: CustomEvent) {
    if (this.selectedMaterialId === undefined) {
      throw new Error('No material selected');
    }

    const id = this.selectedMaterialId;
    const uri = event.detail;
    dispatchAddBaseColorTexture({id, uri});
  }

  onMetallicRoughnessTextureChange() {
    if (this.selectedMaterialId === undefined) {
      throw new Error('No material selected');
    }
    const id = this.selectedMaterialId;
    const textureId = this.selectedMetallicRoughnessTextureId;
    dispatchMetallicRoughnessTexture({id, textureId});
  }

  onMetallicRoughnessTextureUpload(event: CustomEvent) {
    if (this.selectedMaterialId === undefined) {
      throw new Error('No material selected');
    }

    const id = this.selectedMaterialId;
    const uri = event.detail;
    dispatchAddMetallicRoughnessTexture({id, uri});
  }

  onNormalTextureChange() {
    if (this.selectedMaterialId === undefined) {
      throw new Error('No material selected');
    }

    const id = this.selectedMaterialId;
    const textureId = this.selectedNormalTextureId;
    dispatchNormalTexture({id, textureId});
  }

  onNormalTextureUpload(event: CustomEvent) {
    if (this.selectedMaterialId === undefined) {
      throw new Error('No material selected');
    }

    const id = this.selectedMaterialId;
    const uri = event.detail;
    dispatchAddNormalTexture({id, uri});
  }

  onEmissiveTextureChange() {
    if (this.selectedMaterialId === undefined) {
      throw new Error('No material selected');
    }

    const id = this.selectedMaterialId;
    const textureId = this.selectedEmissiveTextureId;
    dispatchEmissiveTexture({id, textureId});
  }

  onEmissiveTextureUpload(event: CustomEvent) {
    if (this.selectedMaterialId === undefined) {
      throw new Error('No material selected');
    }

    const id = this.selectedMaterialId;
    const uri = event.detail;
    dispatchAddEmissiveTexture({id, uri});
  }

  onEmissiveFactorChanged() {
    if (this.selectedMaterialId === undefined) {
      throw new Error('No material selected');
    }

    const id = this.selectedMaterialId;
    const emissiveFactor = this.selectedEmissiveFactor;
    dispatchSetEmissiveFactor({id, emissiveFactor});
  }

  onOcclusionTextureChange() {
    if (this.selectedMaterialId === undefined) {
      throw new Error('No material selected');
    }

    const id = this.selectedMaterialId;
    const textureId = this.selectedOcclusionTextureId;
    dispatchOcclusionTexture({id, textureId});
  }

  onOcclusionTextureUpload(event: CustomEvent) {
    if (this.selectedMaterialId === undefined) {
      throw new Error('No material selected');
    }

    const id = this.selectedMaterialId;
    const uri = event.detail;
    dispatchAddOcclusionTexture({id, uri});
  }

  onAlphaModeSelect() {
    if (this.selectedMaterialId === undefined) {
      throw new Error('No material selected');
    }

    const selectedMode =
        this.alphaModePicker?.selectedItem?.getAttribute('value');

    if (!selectedMode) {
      return;
    }

    dispatchSetAlphaMode({
      id: this.selectedMaterialId,
      alphaMode: selectedMode,
    });
  }

  onAlphaCutoffChange() {
    if (this.selectedMaterialId === undefined) {
      throw new Error('No material selected');
    }

    dispatchSetAlphaCutoff({
      id: this.selectedMaterialId,
      alphaCutoff: this.selectedAlphaCutoff,
    });
  }

  revertMetallicRoughnessTexture() {
    const id = this.safeSelectedMaterialId;
    const textureId = this.originalMaterials[id].metallicRoughnessTextureId;
    dispatchMetallicRoughnessTexture({id, textureId});
  }

  revertMetallicFactor() {
    const id = this.safeSelectedMaterialId;
    const metallicFactor = this.originalMaterials[id].metallicFactor;
    dispatchMetallicFactor({id, metallicFactor});
  }

  revertRoughnessFactor() {
    const id = this.safeSelectedMaterialId;
    const roughnessFactor = this.originalMaterials[id].roughnessFactor;
    dispatchRoughnessFactor({id, roughnessFactor});
  }

  revertBaseColorFactor() {
    const index = this.safeSelectedMaterialId;
    const baseColorFactor = this.originalMaterials[index].baseColorFactor;
    dispatchMaterialBaseColor({index, baseColorFactor});
  }

  revertBaseColorTexture() {
    const id = this.safeSelectedMaterialId;
    const textureId = this.originalMaterials[id].baseColorTextureId;
    dispatchBaseColorTexture({id, textureId});
  }

  revertNormalTexture() {
    const id = this.safeSelectedMaterialId;
    const textureId = this.originalMaterials[id].normalTextureId;
    dispatchNormalTexture({id, textureId});
  }

  revertEmissiveTexture() {
    const id = this.safeSelectedMaterialId;
    const textureId = this.originalMaterials[id].emissiveTextureId;
    dispatchEmissiveTexture({id, textureId});
  }

  revertEmissiveFactor() {
    const id = this.safeSelectedMaterialId;
    const emissiveFactor = this.originalMaterials[id].emissiveFactor;
    dispatchSetEmissiveFactor({id, emissiveFactor});
  }

  revertOcclusionTexture() {
    const id = this.safeSelectedMaterialId;
    const textureId = this.originalMaterials[id].occlusionTextureId;
    dispatchOcclusionTexture({id, textureId});
  }

  revertAlphaCutoff() {
    const id = this.safeSelectedMaterialId;
    const alphaCutoff = this.originalMaterials[id].alphaCutoff;
    dispatchSetAlphaCutoff({id, alphaCutoff});
  }

  revertAlphaMode() {
    const id = this.safeSelectedMaterialId;
    const alphaMode = this.originalMaterials[id].alphaMode;
    dispatchSetAlphaMode({id, alphaMode});
  }

  revertDoubleSided() {
    const id = this.safeSelectedMaterialId;
    const doubleSided = this.originalMaterials[id].doubleSided;
    dispatchDoubleSided({id, doubleSided});
  }

  renderMetallicRoughnessTab() {
    if (this.selectedMaterialId === undefined) {
      return `No material selected`;
    }
    const material = this.materials[this.selectedMaterialId];
    const currentTextureId = material.metallicRoughnessTextureId;
    return html`
  <me-expandable-tab tabName="Metallic Roughness">
    <div slot="content">
      <me-section-row label="Texture">
        <div class="TexturePickerContainer">
          <mwc-icon-button class="RevertButton" id="revert-metallic-roughness-texture" icon="undo"
          title="Revert to original metallic roughness texture"
          @click=${this.revertMetallicRoughnessTexture}></mwc-icon-button>
          <me-texture-picker .selectedIndex=${
        currentTextureId ?
            this.safeUrlIds.indexOf(currentTextureId) :
            undefined} id="metallic-roughness-texture-picker" @texture-changed=${
        this.onMetallicRoughnessTextureChange} @texture-uploaded=${
        this.onMetallicRoughnessTextureUpload} .images=${this.safeTextureUrls}>
          </me-texture-picker>
        </div>
      </me-section-row>
      <div class="MRSliders">
        <div class="MRSliderLabel">Metallic factor</div>
        <div class="MRSliderContainer">
          <mwc-icon-button id="revert-metallic-factor" class="RevertButton" icon="undo"
          title="Revert to original metallic factor"
          @click=${this.revertMetallicFactor}></mwc-icon-button>
          <me-slider-with-input id="metallic-factor" class="MRSlider" min="0.0" max="1.0"
        step="0.01" value="${material.metallicFactor}" @change=${
        this.onMetallicChange}>
          </me-slider-with-input>
        </div>

        <div class="MRSliderLabel">Roughness factor</div>
        <div class="MRSliderContainer">
          <mwc-icon-button id="revert-roughness-factor" class="RevertButton" icon="undo"
          title="Revert to original roughness factor"
          @click=${this.revertRoughnessFactor}></mwc-icon-button>
          <me-slider-with-input id="roughness-factor" class="MRSlider" min="0.0" max="1.0"
          step="0.01" value="${material.roughnessFactor}" @change=${
        this.onRoughnessChange}>
          </me-slider-with-input>
        </div>
      </div>
    </div>
  </me-expandable-tab>`;
  }

  renderBaseColorTab() {
    if (this.selectedMaterialId === undefined) {
      return `No material selected`;
    }
    const currentTextureId =
        this.materials[this.selectedMaterialId].baseColorTextureId;
    const material = this.materials[this.selectedMaterialId];
    const selectedColorRgb = material.baseColorFactor.slice(0, 3).map(
        (color: number) => Math.round(color * 255));
    const selectedColorHex = color.rgbArrayToHex(selectedColorRgb);
    return html`
  <me-expandable-tab tabName="Base Color">
    <div slot="content">
      <me-section-row label="Factor">
        <div class="TexturePickerContainer">
          <mwc-icon-button class="RevertButton" id="revert-base-color-factor" icon="undo"
            title="Revert to original base color factor"
            @click=${this.revertBaseColorFactor}></mwc-icon-button>
          <me-color-picker id="base-color-picker"
          selectedColorHex=${selectedColorHex} @change=${
        this.onBaseColorChange}>
          </me-color-picker>
        </div>
      </me-section-row>
      <me-section-row label="Texture">
        <div class="TexturePickerContainer">
          <mwc-icon-button class="RevertButton" id="revert-base-color-texture" icon="undo"
          title="Revert to original base color texture"
            @click=${this.revertBaseColorTexture}></mwc-icon-button>
          <me-texture-picker .selectedIndex=${
        currentTextureId ?
            this.safeUrlIds.indexOf(currentTextureId) :
            undefined} id="base-color-texture-picker" @texture-changed=${
        this.onBaseColorTextureChange} @texture-uploaded=${
        this.onBaseColorTextureUpload} .images=${
        this.safeTextureUrls}></me-texture-picker>
        </div>
      </me-section-row>
    </div>
  </me-expandable-tab>
    `;
  }

  renderNormalTextureTab() {
    if (this.selectedMaterialId === undefined) {
      return `No material selected`;
    }
    const material = this.materials[this.selectedMaterialId];
    const currentTextureId = material.normalTextureId;
    return html`
  <me-expandable-tab tabName="Normal Map">
    <div slot="content">
      <me-section-row label="Texture">
        <div class="TexturePickerContainer">
          <mwc-icon-button class="RevertButton" id="revert-normal-map-texture" icon="undo"
          title="Revert to original normal map texture"
            @click=${this.revertNormalTexture}></mwc-icon-button>
          <me-texture-picker .selectedIndex=${
        currentTextureId ?
            this.safeUrlIds.indexOf(currentTextureId) :
            undefined} id="normal-texture-picker" @texture-changed=${
        this.onNormalTextureChange} @texture-uploaded=${
        this.onNormalTextureUpload} .images=${this.safeTextureUrls}>
          </me-texture-picker>
        </div>
      </me-section-row>
    </div>
  </me-expandable-tab>`;
  }

  renderEmissiveTextureTab() {
    if (this.selectedMaterialId === undefined) {
      return `No material selected`;
    }
    const material = this.materials[this.selectedMaterialId];
    const currentTextureId = material.emissiveTextureId;
    const emissiveFactor = material.emissiveFactor ?? DEFAULT_EMISSIVE_FACTOR;
    const selectedColorRgb =
        emissiveFactor.map((color: number) => Math.round(color * 255));
    const selectedColorHex = color.rgbArrayToHex(selectedColorRgb);
    return html`
  <me-expandable-tab tabName="Emissive">
    <div slot="content">
      <me-section-row label="Factor">
        <div class="TexturePickerContainer">
          <mwc-icon-button class="RevertButton" id="revert-emissive-factor" icon="undo"
          title="Revert to original emissive factor"
          @click=${this.revertEmissiveFactor}></mwc-icon-button>
          <me-color-picker selectedColorHex=${
        selectedColorHex} id="emissive-factor-picker" @change=${
        this.onEmissiveFactorChanged}></me-color-picker>
        </div>
      </me-section-row>
      <me-section-row label="Texture">
        <div class="TexturePickerContainer">
          <mwc-icon-button class="RevertButton" id="revert-emissive-texture" icon="undo"
          title="Revert to original emissive texture"
          @click=${this.revertEmissiveTexture}></mwc-icon-button>
          <me-texture-picker .selectedIndex=${
        currentTextureId ?
            this.safeUrlIds.indexOf(currentTextureId) :
            undefined} id="emissive-texture-picker" @texture-changed=${
        this.onEmissiveTextureChange} @texture-uploaded=${
        this.onEmissiveTextureUpload} .images=${this.safeTextureUrls}>
        </me-texture-picker>
        </div>
      </me-section-row>
    </div>
  </me-expandable-tab>`;
  }

  renderOcclusionTextureTab() {
    if (this.selectedMaterialId === undefined) {
      return `No material selected`;
    }
    const material = this.materials[this.selectedMaterialId];
    const currentTextureId = material.occlusionTextureId;
    return html`
  <me-expandable-tab tabName="Occlusion">
    <div slot="content">
      <me-section-row label="Texture">
        <div class="TexturePickerContainer">
          <mwc-icon-button class="RevertButton" id="revert-occlusion-texture" icon="undo"
          title="Revert to original occlusion texture"
          @click=${this.revertOcclusionTexture}></mwc-icon-button>
          <me-texture-picker .selectedIndex=${
        currentTextureId ?
            this.safeUrlIds.indexOf(currentTextureId) :
            undefined} id="occlusion-texture-picker" @texture-changed=${
        this.onOcclusionTextureChange} @texture-uploaded=${
        this.onOcclusionTextureUpload} .images=${this.safeTextureUrls}>
          </me-texture-picker>
        </div>
      </me-section-row>
    </div>
  </me-expandable-tab>`;
  }

  renderAlphaBlendModeSection() {
    if (this.selectedMaterialId === undefined) {
      return;
    }

    const material = this.materials[this.selectedMaterialId];
    // Alpha blend mode defaults to 'OPAQUE' by gltf specification.
    const selectedIndex =
        material.alphaMode ? ALPHA_BLEND_MODES.indexOf(material.alphaMode) : 0;
    return html`
    <div class="SectionLabel">Alpha Blend Mode:</div>
    <div class="DropdownContainer">
      <mwc-icon-button class="RevertButton" id="revert-alpha-cutoff" icon="undo"
        title="Revert to original alpha mode"
        @click=${this.revertAlphaMode}></mwc-icon-button>
      <me-dropdown id="alpha-mode-picker"
        selectedIndex=${selectedIndex}
        @select=${this.onAlphaModeSelect}>
        ${
        ALPHA_BLEND_MODES.map(
            mode => html`<paper-item value=${mode}>${mode}</paper-item>`)}
      </me-dropdown>
    </div>
      ${
        material.alphaMode === 'MASK' ?
            html`
      <div class="SectionLabel" id="alpha-cutoff-label">Alpha Cutoff:</div>
        <div class="MRSliderContainer">
          <mwc-icon-button class="RevertButton" id="revert-alpha-mode" icon="undo"
            title="Revert to original alpha cutoff"
            @click=${this.revertAlphaCutoff}></mwc-icon-button>
          <me-slider-with-input class="MRSlider" id="alpha-cutoff" min="0.0" max="1.0"
          step="0.01" value="${
                material.alphaCutoff ??
                0.5  // Alpha cutoff defaults to 0.5 by gltf specification
            }" @change=${this.onAlphaCutoffChange}></me-slider-with-input>
        </div>
      ` :
            html``}
      `;
  }

  renderDoubleSidedSection() {
    if (this.selectedMaterialId === undefined) {
      return;
    }

    // By default, double sided is false. So if it's undefined, assume false.
    return html`
      <div class="CheckboxContainer">
        <mwc-icon-button class="RevertButton" id="revert-occlusion-texture" icon="undo"
        title="Revert to original double sidedness"
        @click=${this.revertDoubleSided}></mwc-icon-button>
        <me-checkbox id="doubleSidedCheckbox"
          ?checked=${
    !!this.materials[this.selectedMaterialId].doubleSided}
          label="Double Sided"
          @change=${this.onDoubleSidedChange}></me-checkbox>
      </div>`;
  }

  renderOtherTab() {
    if (this.selectedMaterialId === undefined) {
      return `No material selected`;
    }
    return html`
      <me-expandable-tab tabName="Other">
        <div slot="content">
        ${this.renderDoubleSidedSection()}
        ${this.renderAlphaBlendModeSection()}
        </div><
        /me-expandable-tab>
    `;
  }

  render() {
    if (this.materials.length === 0) {
      return html`No materials to edit`;
    }

    return html`
    ${this.renderSelectMaterialTab()}
    ${this.renderBaseColorTab()}
    ${this.renderMetallicRoughnessTab()}
    ${this.renderNormalTextureTab()}
    ${this.renderEmissiveTextureTab()}
    ${this.renderOcclusionTextureTab()}
    ${this.renderOtherTab()}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'me-materials-panel': MaterialPanel;
  }
}
