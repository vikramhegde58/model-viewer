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


import './yaw_limits.js';

import {dispatchCurrentCameraState, reduxStore} from '../../redux/space_opera_base.js';

import {DEFAULT_MAX_YAW, dispatchYawLimits, YawLimits} from './yaw_limits.js';

describe('yaw limits editor test', () => {
  let yawLimitsDeg: YawLimits;

  beforeEach(async () => {
    yawLimitsDeg = new YawLimits();
    document.body.appendChild(yawLimitsDeg);
    dispatchYawLimits({enabled: false, min: 0, max: 0});
    await yawLimitsDeg.updateComplete;
  });

  afterEach(() => {
    document.body.removeChild(yawLimitsDeg);
  });

  it('correctly loads yaw limits', async () => {
    dispatchYawLimits({enabled: true, min: 12, max: 34});
    await yawLimitsDeg.updateComplete;
    expect(yawLimitsDeg.inputLimits.enabled).toEqual(true);
    expect(yawLimitsDeg.inputLimits.min).toEqual(12);
    expect(yawLimitsDeg.inputLimits.max).toEqual(34);
  });

  it('correctly dispatches when I click set and clear', async () => {
    dispatchYawLimits({enabled: true, min: 0, max: 99});
    dispatchCurrentCameraState({orbit: {thetaDeg: 33, radius: 10, phiDeg: 0}});
    await yawLimitsDeg.updateComplete;

    (yawLimitsDeg.shadowRoot!.querySelector('#set-max-button')! as
     HTMLInputElement)
        .click();
    expect(reduxStore.getState().camera.yawLimitsDeg!.max).toEqual(33);

    (yawLimitsDeg.shadowRoot!.querySelector('#clear-max-button')! as
     HTMLInputElement)
        .click();
    expect(reduxStore.getState().camera.yawLimitsDeg!.max)
        .toEqual(DEFAULT_MAX_YAW);
  });
});
