import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const JT_MODEL = {
  // Octahedral crystal-field splitting baseline (arbitrary, pedagogical units)
  octahedral: { t2g: 250, eg: 110 },
  // Vibronic coupling strength: larger value -> stronger distortion splitting
  coupling: { eg: 55, t2g: 22 },
  // Geometric baseline and distortion scaling for MnO6
  geometry: { baseBond: 2.45, maxElongation: 0.95, xyCompRatio: 0.42 },
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function computeEnergyLevels(q3, couplingScale) {
  const q = clamp01(q3);
  const egShift = JT_MODEL.coupling.eg * q * couplingScale;
  const t2gShift = JT_MODEL.coupling.t2g * q * couplingScale;

  return {
    oh: {
      eg: JT_MODEL.octahedral.eg,
      t2g: JT_MODEL.octahedral.t2g,
    },
    d4h: {
      eg: {
        dx2y2: JT_MODEL.octahedral.eg - egShift,
        dz2: JT_MODEL.octahedral.eg + egShift,
      },
      t2g: {
        dxy: JT_MODEL.octahedral.t2g - t2gShift,
        dxzdyz: JT_MODEL.octahedral.t2g + t2gShift,
      },
    },
    stabilizationEnergy: egShift,
  };
}

const NativeThreeScene = ({ distortionProgress }) => {
  const mountRef = useRef(null);
  const target = useRef(distortionProgress);

  useEffect(() => {
    target.current = clamp01(distortionProgress);
  }, [distortionProgress]);

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(4, 3.2, 6.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    const resize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    resize();

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    keyLight.position.set(8, 10, 10);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
    fillLight.position.set(-10, -8, -8);
    scene.add(fillLight);

    const group = new THREE.Group();
    scene.add(group);

    const geoSphere = new THREE.SphereGeometry(1, 36, 36);
    const geoBond = new THREE.CylinderGeometry(1, 1, 1, 20);

    const matMn = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.2, metalness: 0.45 });
    const matO = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 });
    const matOrbital = new THREE.MeshStandardMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.24, depthWrite: false });
    const matBondZ = [0, 1].map(() => new THREE.MeshStandardMaterial({ color: 0xffffff }));
    const matBondXY = [0, 1, 2, 3].map(() => new THREE.MeshStandardMaterial({ color: 0xffffff }));

    const center = new THREE.Mesh(geoSphere, matMn);
    center.scale.setScalar(0.62);
    group.add(center);

    const zAtoms = [];
    const zBonds = [];
    for (let i = 0; i < 2; i += 1) {
      const o = new THREE.Mesh(geoSphere, matO);
      o.scale.setScalar(0.4);
      group.add(o);
      zAtoms.push(o);

      const b = new THREE.Mesh(geoBond, matBondZ[i]);
      b.scale.set(0.08, 1, 0.08);
      group.add(b);
      zBonds.push(b);
    }

    const xyAtoms = [];
    const xyBonds = [];
    for (let i = 0; i < 4; i += 1) {
      const o = new THREE.Mesh(geoSphere, matO);
      o.scale.setScalar(0.4);
      group.add(o);
      xyAtoms.push(o);

      const b = new THREE.Mesh(geoBond, matBondXY[i]);
      b.scale.set(0.08, 1, 0.08);
      if (i < 2) b.rotation.z = Math.PI / 2;
      else b.rotation.x = Math.PI / 2;
      group.add(b);
      xyBonds.push(b);
    }

    const dz2Orbital = new THREE.Mesh(geoBond, matOrbital);
    dz2Orbital.scale.set(0.42, 4, 0.42);
    group.add(dz2Orbital);

    const colorWhite = new THREE.Color('#ffffff');
    const colorZ = new THREE.Color('#93c5fd');
    const colorXY = new THREE.Color('#fdba74');

    let frame;
    let pCurrent = target.current;
    const tick = () => {
      pCurrent += (target.current - pCurrent) * 0.08;
      const p = clamp01(pCurrent);

      const zDist = JT_MODEL.geometry.baseBond + p * JT_MODEL.geometry.maxElongation;
      const xyDist = JT_MODEL.geometry.baseBond - p * JT_MODEL.geometry.maxElongation * JT_MODEL.geometry.xyCompRatio;

      zAtoms[0].position.set(0, zDist, 0);
      zAtoms[1].position.set(0, -zDist, 0);
      zBonds[0].position.set(0, zDist / 2, 0);
      zBonds[1].position.set(0, -zDist / 2, 0);
      zBonds.forEach((b, i) => {
        b.scale.set(0.08, zDist, 0.08);
        matBondZ[i].color.copy(colorWhite).lerp(colorZ, p);
      });

      const xyCoord = [
        [xyDist, 0, 0],
        [-xyDist, 0, 0],
        [0, 0, xyDist],
        [0, 0, -xyDist],
      ];
      xyAtoms.forEach((atom, i) => atom.position.set(...xyCoord[i]));
      xyBonds.forEach((bond, i) => {
        bond.scale.set(0.08, xyDist, 0.08);
        bond.position.set(xyCoord[i][0] / 2, 0, xyCoord[i][2] / 2);
        matBondXY[i].color.copy(colorWhite).lerp(colorXY, p);
      });

      dz2Orbital.scale.set(0.42, 4 * (1 + 0.48 * p), 0.42);
      matOrbital.opacity = 0.24 + 0.28 * p;

      group.rotation.y += 0.004;
      group.rotation.x = Math.sin(Date.now() * 0.0011) * 0.12;
      group.rotation.z = Math.cos(Date.now() * 0.0007) * 0.04;

      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };

    tick();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame);
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
      [geoSphere, geoBond].forEach((g) => g.dispose());
      [matMn, matO, matOrbital, ...matBondZ, ...matBondXY].forEach((m) => m.dispose());
      renderer.dispose();
    };
  }, []);

  return <div ref={mountRef} className="w-full h-full" />;
};

const Electron = ({ x, y, accent = false }) => (
  <text x={x} y={y} textAnchor="middle" fill={accent ? '#ef4444' : '#cbd5e1'} fontSize="22px" fontWeight="bold">
    ↑
  </text>
);

const EnergyDiagram = ({ distortionProgress, couplingScale }) => {
  const levels = useMemo(() => computeEnergyLevels(distortionProgress, couplingScale), [distortionProgress, couplingScale]);
  const style = { transition: 'all 500ms cubic-bezier(0.4, 0, 0.2, 1)' };

  return (
    <svg width="100%" height="100%" viewBox="0 0 420 360" className="bg-slate-800 rounded-xl">
      <line x1="42" y1="320" x2="42" y2="38" stroke="#94a3b8" strokeWidth="2" />
      <text x="14" y="30" fill="#94a3b8" fontSize="14px">Energy</text>

      <g transform="translate(62, 0)">
        <text x="60" y="30" fill="white" textAnchor="middle" fontSize="14px">Oh</text>
        <line x1="20" y1={levels.oh.eg} x2="100" y2={levels.oh.eg} stroke="white" strokeWidth="2" />
        <line x1="20" y1={levels.oh.t2g} x2="100" y2={levels.oh.t2g} stroke="white" strokeWidth="2" />
        <text x="106" y={levels.oh.eg + 4} fill="white" fontSize="12px">e_g</text>
        <text x="106" y={levels.oh.t2g + 4} fill="white" fontSize="12px">t_2g</text>
        <Electron x={60} y={levels.oh.eg} accent />
        <Electron x={40} y={levels.oh.t2g} />
        <Electron x={60} y={levels.oh.t2g} />
        <Electron x={80} y={levels.oh.t2g} />
      </g>

      <g transform="translate(242, 0)">
        <text x="60" y="30" fill="#fca5a5" textAnchor="middle" fontSize="14px" fontWeight="bold">D4h (JT)</text>
        <line x1="20" y1={levels.d4h.eg.dx2y2} x2="100" y2={levels.d4h.eg.dx2y2} stroke="#fb923c" strokeWidth="2" style={style} />
        <line x1="20" y1={levels.d4h.eg.dz2} x2="100" y2={levels.d4h.eg.dz2} stroke="#3b82f6" strokeWidth="3" style={style} />
        <text x="106" y={levels.d4h.eg.dx2y2 + 4} fill="#fb923c" fontSize="12px">d_x²-y²</text>
        <text x="106" y={levels.d4h.eg.dz2 + 4} fill="#3b82f6" fontSize="12px" fontWeight="bold">d_z²</text>
        <Electron x={60} y={levels.d4h.eg.dz2} accent />

        <line x1="20" y1={levels.d4h.t2g.dxy} x2="100" y2={levels.d4h.t2g.dxy} stroke="#fb923c" strokeWidth="2" style={style} />
        <line x1="20" y1={levels.d4h.t2g.dxzdyz} x2="100" y2={levels.d4h.t2g.dxzdyz} stroke="#3b82f6" strokeWidth="2" style={style} />
        <text x="106" y={levels.d4h.t2g.dxy + 4} fill="#fb923c" fontSize="12px">d_xy</text>
        <text x="106" y={levels.d4h.t2g.dxzdyz + 4} fill="#3b82f6" fontSize="12px">d_xz, d_yz</text>
        <Electron x={60} y={levels.d4h.t2g.dxy} />
        <Electron x={40} y={levels.d4h.t2g.dxzdyz} />
        <Electron x={80} y={levels.d4h.t2g.dxzdyz} />
      </g>

      <line x1="162" y1={levels.oh.eg} x2="242" y2={levels.d4h.eg.dx2y2} stroke="#64748b" strokeDasharray="4" style={style} />
      <line x1="162" y1={levels.oh.eg} x2="242" y2={levels.d4h.eg.dz2} stroke="#64748b" strokeDasharray="4" style={style} />
      <line x1="162" y1={levels.oh.t2g} x2="242" y2={levels.d4h.t2g.dxy} stroke="#64748b" strokeDasharray="4" style={style} />
      <line x1="162" y1={levels.oh.t2g} x2="242" y2={levels.d4h.t2g.dxzdyz} stroke="#64748b" strokeDasharray="4" style={style} />

      <text x="284" y="336" fill="#facc15" fontSize="12px" textAnchor="middle">
        ΔE(JT) ≈ -{levels.stabilizationEnergy.toFixed(1)}
      </text>
    </svg>
  );
};

export default function RobustJTVisualizer() {
  const [distortionProgress, setDistortionProgress] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [couplingScale, setCouplingScale] = useState(1);

  useEffect(() => {
    if (!autoPlay) return undefined;
    let id;
    const start = performance.now();
    const loop = (t) => {
      const phase = ((t - start) / 1800) % (Math.PI * 2);
      setDistortionProgress((Math.sin(phase) + 1) / 2);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [autoPlay]);

  const levels = useMemo(() => computeEnergyLevels(distortionProgress, couplingScale), [distortionProgress, couplingScale]);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 text-slate-800 flex justify-center font-sans">
      <div className="max-w-6xl w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <header className="bg-indigo-900 text-white p-6 text-center">
          <h1 className="text-3xl font-bold tracking-wide">Jahn-Teller Distortion in Mn³⁺ (3d⁴)</h1>
          <p className="mt-2 text-indigo-200">把「幾何畸變 → 軌域分裂 → 穩定化能」用同一套參數連起來。</p>
        </header>

        <div className="p-6 space-y-6">
          <section className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <h2 className="font-semibold mb-3">控制面板（可當作 AI 掃描參數）</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <label className="text-sm">
                <span className="block mb-1">Q3 畸變強度: {distortionProgress.toFixed(2)}</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={distortionProgress}
                  disabled={autoPlay}
                  onChange={(e) => setDistortionProgress(Number(e.target.value))}
                  className="w-full"
                />
              </label>
              <label className="text-sm">
                <span className="block mb-1">電子-晶格耦合 λ: {couplingScale.toFixed(2)}</span>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.01"
                  value={couplingScale}
                  onChange={(e) => setCouplingScale(Number(e.target.value))}
                  className="w-full"
                />
              </label>
              <button
                type="button"
                onClick={() => setAutoPlay((v) => !v)}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold"
              >
                {autoPlay ? '停止自動掃描' : '啟用自動掃描'}
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              目前穩定化能估計：<b className="text-amber-600">ΔE ≈ -{levels.stabilizationEnergy.toFixed(1)}</b>（教學單位）。
            </p>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="flex flex-col">
              <h3 className="text-lg font-bold mb-2">Step 1：MnO₆ 幾何</h3>
              <div className="bg-black rounded-xl overflow-hidden h-[360px] relative">
                <div className="absolute top-3 left-3 text-xs text-white/80 z-10">
                  z 軸拉長，xy 平面補償壓縮
                </div>
                <NativeThreeScene distortionProgress={distortionProgress} />
              </div>
            </div>

            <div className="flex flex-col">
              <h3 className="text-lg font-bold mb-2">Step 2：能階重排</h3>
              <div className="h-[360px] rounded-xl overflow-hidden shadow-inner">
                <EnergyDiagram distortionProgress={distortionProgress} couplingScale={couplingScale} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
