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

import '@material/mwc-icon-button';
import '../popup/popup.js';
import '../../file_modal/file_modal.js';

import {checkFinite, IMAGE_MIME_TYPES} from '@google/model-viewer-editing-adapter/lib/main.js'
import {createSafeObjectURL, SafeObjectUrl} from '@google/model-viewer-editing-adapter/lib/util/create_object_url.js'
import {customElement, html, LitElement, property, query} from 'lit-element';

import {FileModalElement} from '../../file_modal/file_modal.js';

import {styles} from './texture_picker.css.js';

const ACCEPT_IMAGE_TYPE = IMAGE_MIME_TYPES.join(',');

/**
 * LitElement for a texture picker which allows user to select one of the
 * texture images presented
 *
 * @fires texture-selected
 * @fires texture-uploaded<SafeObjectUrl>
 */
@customElement('me-texture-picker')
export class TexturePicker extends LitElement {
  static styles = styles;

  @property({type: Array}) images: SafeObjectUrl[] = [];
  @property({type: Number}) selectedIndex?: number;
  @query('me-file-modal#textureUpload') textureFileModal!: FileModalElement;

  render() {
    return html`
  <me-popup>
    ${this.renderTextureSquare()}
    <div slot="content" class="PickerContentContainer">
      <div class="TexturePanel">
        <div class="TextureList">
          ${this.images.map((imageUrl, index) => html`
            <label>
              <input
                class="TextureOptionInput"
                index="${index}"
                type="radio"
                name="textureSelect"
                @click="${this.onTextureChange}">
              <img class="TextureImage" src="${imageUrl.url}">
            </label>
            `)}
          <div slot="label" id="nullTextureSquare" class="NullTextureSquareInList" @click=${
        this.onTextureClear}>
            <span class="TextureImage"></span>
          </div>
        </div>
        ${this.renderTextureUploadButton()}
      </div>
    </div>
  </me-popup>
  ${this.renderTextureUploadModal()}
  `;
  }

  renderTextureSquare() {
    if (this.selectedIndex === undefined || this.images.length === 0) {
      return html`
          <div slot="label" class="NullTextureSquare">
            <span class="TextureImage"></span>
          </div>
          `;
    } else {
      return html`
          <div slot="label" class="TextureSquare">
          <img class="TextureImage" src="${
          this.images[this.selectedIndex].url}"></div>`;
    }
  }

  renderTextureUploadButton() {
    return html`
        <mwc-icon-button id="uploadButton" class=${
        this.images.length > 0 ?
            'UploadButton' :
            'UploadButtonNoTextures'} icon="cloud_upload" @click="${
        this.openFileModal}"></mwc-icon-button>`;
  }

  renderTextureUploadModal() {
    return html`<me-file-modal id="textureUpload" accept=${ACCEPT_IMAGE_TYPE}
      @click="${this.stopPropagation}">
  </me-file-modal>`;
  }

  // Mouse events outside closes popup, to prevent this, intercept mouse
  // event on FileModalElement.
  stopPropagation(event: Event) {
    event.stopPropagation();
  }

  onTextureChange(event: Event) {
    this.selectedIndex = checkFinite(
        Number((event.target as HTMLInputElement).getAttribute('index')));
    this.dispatchEvent(new CustomEvent('texture-changed'));
  }

  onTextureClear() {
    this.selectedIndex = undefined;
    this.dispatchEvent(new CustomEvent('texture-changed'));
  }

  async openFileModal() {
    const files = await this.textureFileModal.open();
    if (!files) {
      return;
    }

    const url = createSafeObjectURL(files[0]).unsafeUrl;
    this.dispatchEvent(new CustomEvent('texture-uploaded', {detail: url}));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'me-texture-picker': TexturePicker;
  }
}
