import { Capacitor } from '@capacitor/core';

// PART 1 — BATTERY OPTIMIZATION WHITELIST PROMPT
export async function requestBatteryOptimization() {
  if (!Capacitor.isNativePlatform()) {
    console.log('🔋 Battery optimization check: Not on native platform, skipping.');
    return;
  }
  
  // Don't show if already seen
  if (localStorage.getItem('battery_optimization_seen') === 'true') return;

  // Show dialog to driver
  const dialog = document.createElement('div');
  dialog.id = 'battery-optimization-dialog';
  dialog.innerHTML = `
    <div style="
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      z-index: 100000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      backdrop-filter: blur(8px);
    ">
      <div style="
        background: white;
        border-radius: 28px;
        padding: 32px;
        max-width: 360px;
        width: 100%;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      ">
        <div style="font-size:48px;text-align:center;margin-bottom:16px">
          🔋
        </div>
        <h3 style="
          text-align:center;
          font-size:22px;
          font-weight:800;
          color:#0F172A;
          margin:0 0 12px;
          tracking-tight
        ">
          Background GPS
        </h3>
        <p style="
          color:#475569;
          font-size:15px;
          text-align:center;
          margin-bottom:24px;
          line-height:1.6;
          font-weight:500;
        ">
          To share location while screen is off, allow CampusWay to run without battery restrictions.
        </p>
        <button id="allowBattery" style="
          width:100%;
          background:#4F46E5;
          color:white;
          border:none;
          border-radius:16px;
          padding:16px;
          font-size:16px;
          font-weight:700;
          margin-bottom:12px;
          cursor:pointer;
          box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
          transition: transform 0.2s;
        ">
          Allow Unrestricted
        </button>
        <button id="skipBattery" style="
          width:100%;
          background:transparent;
          color:#64748B;
          border:none;
          padding:12px;
          font-size:14px;
          font-weight:600;
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
      localStorage.setItem('battery_optimization_seen', 'true');
      console.log('🔋 Opening battery optimization settings...');
      window.location.href = 'android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS';
      dialog.remove();
      resolve();
    });
      
    document.getElementById('skipBattery')?.addEventListener('click', () => {
      localStorage.setItem('battery_optimization_seen', 'true');
      console.log('🔋 Battery optimization skipped.');
      dialog.remove();
      resolve();
    });
  });
}

// PART 2 — BRAND-SPECIFIC INSTRUCTIONS
export function showBrandSpecificInstructions() {
  if (localStorage.getItem('brand_instructions_seen') === 'true') return;

  const userAgent = navigator.userAgent.toLowerCase();
  let brand = 'other';
  let brandName = 'Android';
  let brandIcon = '🤖';
  let steps: string[] = [];
  
  if (userAgent.includes('xiaomi') || userAgent.includes('miui') || userAgent.includes('redmi')) {
    brand = 'xiaomi';
    brandName = 'Xiaomi / Redmi (MIUI)';
    brandIcon = '🟠';
    steps = [
      '1. Settings → Apps → CampusWay → Battery Saver → No restrictions',
      '2. Settings → Battery & Performance → Choose apps → CampusWay → No restrictions',
      '3. Settings → Apps → Permissions → AutoStart → Enable CampusWay'
    ];
  } else if (userAgent.includes('samsung')) {
    brand = 'samsung';
    brandName = 'Samsung (OneUI)';
    brandIcon = '🔵';
    steps = [
      '1. Settings → Apps → CampusWay → Battery → Unrestricted',
      '2. Settings → Device Care → Battery → Background usage limits → Never sleeping apps → Add CampusWay',
      '3. Settings → Apps → CampusWay → Permissions → Location → Allow all the time'
    ];
  } else if (userAgent.includes('vivo')) {
    brand = 'vivo';
    brandName = 'Vivo (FuntouchOS)';
    brandIcon = '💠';
    steps = [
      '1. Settings → Battery → High Background Power Consumption → Add CampusWay',
      '2. i Manager → App Manager → CampusWay → Allow background running',
      '3. Settings → Apps → CampusWay → Permissions → Location → Always'
    ];
  } else if (userAgent.includes('oppo') || userAgent.includes('realme')) {
    brand = 'oppo';
    brandName = 'OPPO / Realme (ColorOS)';
    brandIcon = '🟢';
    steps = [
      '1. Settings → Battery → Energy Saver → CampusWay → Don\'t optimize',
      '2. Settings → Apps → CampusWay → Battery → Allow background activity',
      '3. Phone Manager → Privacy Permissions → Start-up manager → Enable CampusWay'
    ];
  } else if (userAgent.includes('huawei')) {
    brand = 'huawei';
    brandName = 'Huawei / Honor';
    brandIcon = '🔴';
    steps = [
      '1. Settings → Apps → CampusWay → Battery → App launch → Manage manually → Enable all',
      '2. Settings → Battery → Launch → CampusWay → Manage manually',
      '3. Settings → Apps → Permissions → Location → Always allow'
    ];
  } else {
    brand = 'stock';
    brandName = 'Nokia / Moto / Stock Android';
    brandIcon = '🤖';
    steps = [
      '1. Settings → Apps → CampusWay → Battery → Unrestricted',
      '2. Settings → Location → App permissions → CampusWay → Allow all the time'
    ];
  }
  
  showStepsDialog(brandName, brandIcon, steps);
}

function showStepsDialog(brand: string, icon: string, steps: string[]) {
  const stepsHTML = steps.map(s => `
    <div style="
      padding: 14px 0;
      border-bottom: 1px solid #F1F5F9;
      color: #334155;
      font-size: 14px;
      line-height: 1.5;
      display: flex;
      gap: 12px;
      font-weight: 500;
    ">
      <div style="color:#6366F1;font-weight:800">${s.split('.')[0]}.</div>
      <div>${s.split('.').slice(1).join('.').trim()}</div>
    </div>
  `).join('');
  
  const dialog = document.createElement('div');
  dialog.id = 'brand-steps-dialog';
  dialog.innerHTML = `
    <div style="
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      z-index: 100000;
      display: flex;
      align-items: flex-end;
      padding: 16px;
      backdrop-filter: blur(8px);
    ">
      <div style="
        background: white;
        border-radius: 32px 32px 24px 24px;
        padding: 32px 24px;
        width: 100%;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 -10px 25px -5px rgba(0, 0, 0, 0.1);
        animate-in slide-in-from-bottom duration-500;
      ">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
          <div style="font-size:28px">${icon}</div>
          <h3 style="
            font-size:20px;
            font-weight:800;
            color:#0F172A;
            letter-spacing:-0.02em;
          ">
            ${brand} Settings
          </h3>
        </div>
        <p style="
          color:#64748B;
          font-size:14px;
          margin-bottom:20px;
          font-weight:500;
        ">
          Follow these steps to keep GPS running in the background while you drive:
        </p>
        <div style="margin-bottom:24px">
          ${stepsHTML}
        </div>
        <button id="closeBrandSteps" style="
          width:100%;
          background:#4F46E5;
          color:white;
          border:none;
          border-radius:16px;
          padding:18px;
          font-size:16px;
          font-weight:700;
          cursor:pointer;
          box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
        ">
          I've Done This
        </button>
        <button id="skipInstructions" style="
          width:100%;
          background:transparent;
          color:#94A3B8;
          border:none;
          padding:12px;
          font-size:14px;
          font-weight:600;
          margin-top:8px;
          cursor:pointer;
        ">
          Skip for now
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  document.getElementById('closeBrandSteps')?.addEventListener('click', () => {
    localStorage.setItem('brand_instructions_seen', 'true');
    dialog.remove();
  });

  document.getElementById('skipInstructions')?.addEventListener('click', () => {
    localStorage.setItem('brand_instructions_seen', 'true');
    dialog.remove();
  });
}
