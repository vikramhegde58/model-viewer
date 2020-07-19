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



import {toVector3D} from '../../redux/hotspot_config.js';
import {dispatchAddHotspot, dispatchClearHotspot} from '../../redux/hotspot_dispatchers.js';
import {reduxStore} from '../../redux/space_opera_base.js';

import {HotspotEditorElement} from './hotspot_editor.js';

describe('hotspot editor test', () => {
  let hotspotEditor: HotspotEditorElement;

  beforeEach(async () => {
    const config = {
      name: 'test',
      position: toVector3D([1, 0, 0]),
    };
    dispatchAddHotspot(config);
    hotspotEditor = new HotspotEditorElement();
    hotspotEditor.config = config;
    document.body.appendChild(hotspotEditor);
    await hotspotEditor.updateComplete;
  });

  afterEach(() => {
    document.body.removeChild(hotspotEditor);
    dispatchClearHotspot();
  });

  it('fires dispatchUpdateHotspot when user updates annotation text', () => {
    const annotationTextArea =
        hotspotEditor.shadowRoot!.querySelector('textarea#annotation') as
        HTMLTextAreaElement;
    annotationTextArea.value = 'new annotation';
    annotationTextArea.dispatchEvent(new Event('input'));

    const hotspots = reduxStore.getState().hotspots;
    expect(hotspots.length).toBe(1);
    expect(hotspots[0].annotation).toBe('new annotation');
  });

  it('fires dispatchRemoveHotspot when remove button is clicked', () => {
    const removeButton = hotspotEditor.shadowRoot!.querySelector(
                             'mwc-icon-button#remove-hotspot') as HTMLElement;
    removeButton.click();
    const hotspots = reduxStore.getState().hotspots;
    expect(hotspots.length).toBe(0);
  });
});
