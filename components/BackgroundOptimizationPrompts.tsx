import { Capacitor } from '@capacitor/core';

// PART 1 — BATTERY OPTIMIZATION WHITELIST PROMPT
export async function requestBatteryOptimization() {
  if (!Capacitor.isNativePlatform()) {
    console.log('🔋 Battery optimization check: Not on native platform, skipping.');
    return;
  }
  
  // Show dialog to driver
  const dialog = document.createElement('div');
  dialog.id = 'battery-optimization-dialog';
  dialog.innerHTML = `
    <div style="
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    ">
      <div style="
        background: white;
        border-radius: 20px;
        padding: 24px;
        max-width: 320px;
        width: 100%;
      ">
        <div style="font-size:40px;text-align:center">
          🔋
        </div>
        <h3 style="
          text-align:center;
          font-size:18px;
          font-weight:700;
          color:#1E293B;
          margin:12px 0 8px;
        ">
          Keep GPS Running
        </h3>
        <p style="
          color:#64748B;
          font-size:14px;
          text-align:center;
          margin-bottom:20px;
          line-height:1.5;
        ">
          To share location even when screen 
          is off, allow CampusWay to run 
          without battery restrictions.
        </p>
        <button id="allowBattery" style="
          width:100%;
          background:#4F46E5;
          color:white;
          border:none;
          border-radius:12px;
          padding:14px;
          font-size:15px;
          font-weight:600;
          margin-bottom:8px;
          cursor:pointer;
        ">
          Allow Unrestricted
        </button>
        <button id="skipBattery" style="
          width:100%;
          background:transparent;
          color:#64748B;
          border:none;
          padding:10px;
          font-size:14px;
          cursor:pointer;
        ">
          Skip (GPS may stop)
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);
  
  return new Promise<void>((resolve) => {
    document.getElementById('allowBattery')?.addEventListener('click', () => {
      // Open battery optimization settings
      console.log('🔋 Opening battery optimization settings...');
      window.location.href = 'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS';
      dialog.remove();
      resolve();
    });
      
    document.getElementById('skipBattery')?.addEventListener('click', () => {
      console.log('🔋 Battery optimization skipped.');
      dialog.remove();
      resolve();
    });
  });
}

// PART 2 — BRAND-SPECIFIC INSTRUCTIONS
export function showBrandSpecificInstructions() {
  const userAgent = navigator.userAgent.toLowerCase();
  let brand = 'other';
  let steps: string[] = [];
  
  if (userAgent.includes('xiaomi') || 
      userAgent.includes('miui') ||
      userAgent.includes('redmi')) {
    brand = 'Xiaomi/Redmi/MIUI';
    steps = [
      '1. Settings → Apps → CampusWay',
      '2. Battery Saver → No restrictions',
      '3. Settings → Battery & Performance',
      '4. → Choose apps → CampusWay → No restrictions',
      '5. Security App → Permissions → Autostart → Enable CampusWay'
    ];
  } else if (userAgent.includes('oneplus') || 
             userAgent.includes('oxygen')) {
    brand = 'OnePlus';
    steps = [
      '1. Settings → Battery → Battery Optimization',
      '2. Find CampusWay → Don\'t optimize',
      '3. Settings → Apps → CampusWay',
      '4. Battery → Allow background activity'
    ];
  } else if (userAgent.includes('samsung')) {
    brand = 'Samsung';
    steps = [
      '1. Settings → Apps → CampusWay',
      '2. Battery → Unrestricted',
      '3. Settings → Device Care → Battery',
      '4. Background usage limits → OFF',
      '5. Never sleeping apps → Add CampusWay'
    ];
  } else if (userAgent.includes('vivo')) {
    brand = 'Vivo';
    steps = [
      '1. Settings → Battery → High Background Power',
      '2. Add CampusWay to list',
      '3. iManager → App Manager → CampusWay',
      '4. Allow Background Running → ON'
    ];
  } else if (userAgent.includes('oppo') || 
             userAgent.includes('realme')) {
    brand = 'OPPO/Realme';
    steps = [
      '1. Settings → Battery → App Quick Freeze',
      '2. Remove CampusWay from list',
      '3. Settings → Apps → CampusWay',
      '4. Battery Saver → Don\'t restrict'
    ];
  } else if (userAgent.includes('huawei')) {
    brand = 'Huawei';
    steps = [
      '1. Settings → Apps → CampusWay',
      '2. Battery → Remove from optimization',
      '3. Phone Manager → Protected Apps',
      '4. Enable CampusWay protection'
    ];
  }
  
  if (steps.length === 0) {
    console.log('📱 Phone brand instructions: Stock Android or undetected, skipping.');
    return;
  }
  
  showStepsDialog(brand, steps);
}

function showStepsDialog(brand: string, steps: string[]) {
  const stepsHTML = steps.map(s => `
    <div style="
      padding: 10px 0;
      border-bottom: 1px solid #F1F5F9;
      color: #1E293B;
      font-size: 13px;
      line-height: 1.4;
    ">${s}</div>
  `).join('');
  
  const dialog = document.createElement('div');
  dialog.id = 'brand-steps-dialog';
  dialog.innerHTML = `
    <div style="
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      z-index: 99999;
      display: flex;
      align-items: flex-end;
      padding: 16px;
    ">
      <div style="
        background: white;
        border-radius: 20px;
        padding: 24px;
        width: 100%;
        max-height: 80vh;
        overflow-y: auto;
      ">
        <h3 style="
          font-size:16px;
          font-weight:700;
          color:#1E293B;
          margin-bottom:4px;
        ">
          ${brand} Settings
        </h3>
        <p style="
          color:#64748B;
          font-size:13px;
          margin-bottom:16px;
        ">
          Follow these steps to keep GPS 
          running in background:
        </p>
        ${stepsHTML}
        <button id="closeBrandSteps" style="
          width:100%;
          background:#4F46E5;
          color:white;
          border:none;
          border-radius:12px;
          padding:14px;
          font-size:15px;
          font-weight:600;
          margin-top:16px;
          cursor:pointer;
        ">
          Got it!
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  document.getElementById('closeBrandSteps')?.addEventListener('click', () => {
    dialog.remove();
  });
}
