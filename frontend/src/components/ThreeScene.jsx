import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';

export default function ThreeScene({ machines, selectedMachineId, onMachineClick, activeScenario, station = 'BHARATI_STATION' }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  
  const bharatiGroupRef = useRef(null);
  const maitriGroupRef = useRef(null);
  const machineMeshesRef = useRef({}); 
  const roofsRef = useRef([]);
  const particlesRef = useRef(null);
  
  const targetCamPos = useRef(new THREE.Vector3(0, 16, 28));
  const targetLookAt = useRef(new THREE.Vector3(0, 3, 0));
  const isTransitioning = useRef(false);
  const isFirstRender = useRef(true);

  const onMachineClickRef = useRef(onMachineClick);
  const activeScenarioRef = useRef(activeScenario);

  useEffect(() => { onMachineClickRef.current = onMachineClick; }, [onMachineClick]);
  useEffect(() => { activeScenarioRef.current = activeScenario; }, [activeScenario]);

  useEffect(() => {
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x02050a);
    scene.fog = new THREE.FogExp2(0x02050a, 0.015);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 16, 32); 
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    const isCompactViewport = window.matchMedia('(max-width: 768px)').matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCompactViewport ? 1.25 : 2));
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; 
    controls.minDistance = 5;
    controls.maxDistance = 60;
    controls.target.set(0, 3, 0);
    controlsRef.current = controls;

    controls.addEventListener('start', () => { isTransitioning.current = false; });

    scene.add(new THREE.AmbientLight(0xe0f2fe, 0.8));
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.position.set(20, 35, 15);
    scene.add(sunLight);

    const clickableList = [];

    const createFlagTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 300; canvas.height = 200;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FF9933'; ctx.fillRect(0, 0, 300, 66);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 66, 300, 66);
      ctx.fillStyle = '#138808'; ctx.fillRect(0, 132, 300, 68);
      ctx.beginPath(); ctx.arc(150, 100, 24, 0, 2 * Math.PI);
      ctx.strokeStyle = '#000080'; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < 24; i++) {
        ctx.beginPath(); ctx.moveTo(150, 100);
        ctx.lineTo(150 + 24 * Math.cos(i * Math.PI / 12), 100 + 24 * Math.sin(i * Math.PI / 12));
        ctx.stroke();
      }
      return new THREE.CanvasTexture(canvas);
    };
    const flagMat = new THREE.MeshBasicMaterial({ map: createFlagTexture(), side: THREE.DoubleSide });

    const addMachine = (id, pos, size, group, label) => {
      const mGroup = new THREE.Group();
      mGroup.position.set(...pos);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color: 0x00d2ff, metalness: 0.8, roughness: 0.2 }));
      mesh.userData = { id };
      mGroup.add(mesh);
      const ring = new THREE.Mesh(new THREE.RingGeometry(Math.max(...size)/2 + 0.2, Math.max(...size)/2 + 0.4, 32).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({ color: 0x00d2ff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
      ring.position.y = size[1] / 2 + 0.15;
      mGroup.add(ring);
      group.add(mGroup);
      if (!machineMeshesRef.current[id]) machineMeshesRef.current[id] = [];
      machineMeshesRef.current[id].push({ mesh, ring });
      clickableList.push(mesh);
    };

    const buildHollowRoom = (w, h, d, wallMat, floorMat) => {
      const group = new THREE.Group();
      const thick = 0.3;
      const floor = new THREE.Mesh(new THREE.BoxGeometry(w, thick, d), floorMat);
      floor.position.y = -h/2 + thick/2;
      group.add(floor);
      const wallH = h - thick;
      const wallY = thick/2;
      const front = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, thick), wallMat);
      front.position.set(0, wallY, d/2 - thick/2);
      group.add(front);
      const back = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, thick), wallMat);
      back.position.set(0, wallY, -d/2 + thick/2);
      group.add(back);
      const left = new THREE.Mesh(new THREE.BoxGeometry(thick, wallH, d - thick*2), wallMat);
      left.position.set(-w/2 + thick/2, wallY, 0);
      group.add(left);
      const right = new THREE.Mesh(new THREE.BoxGeometry(thick, wallH, d - thick*2), wallMat);
      right.position.set(w/2 - thick/2, wallY, 0);
      group.add(right);
      return group;
    };

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.4, roughness: 0.4 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.5, transparent: true, opacity: 1.0 });
    const stiltMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });

    // ================== BHARATI ==================
    const bharatiGroup = new THREE.Group();
    bharatiGroupRef.current = bharatiGroup;
    scene.add(bharatiGroup);

    const bTerrainGeo = new THREE.PlaneGeometry(150, 150, 64, 64).rotateX(-Math.PI / 2);
    const bPos = bTerrainGeo.attributes.position;
    for (let i = 0; i < bPos.count; i++) {
      const x = bPos.getX(i), z = bPos.getZ(i);
      if (Math.sqrt(x*x + z*z) > 18) bPos.setY(i, Math.max(0, Math.sin(x*0.1)*Math.cos(z*0.1)*5));
    }
    bTerrainGeo.computeVertexNormals();
    bharatiGroup.add(new THREE.Mesh(bTerrainGeo, new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9, flatShading: true })));

    const bLowerRoom = buildHollowRoom(14, 4, 10, wallMat, floorMat);
    bLowerRoom.position.set(0, 3.5, 0);
    bharatiGroup.add(bLowerRoom);

    const bUpperRoom = buildHollowRoom(14, 3.5, 12, wallMat, floorMat);
    bUpperRoom.position.set(0, 7.25, 2);
    bharatiGroup.add(bUpperRoom);

    const bRoofLower = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.4, 10.2), roofMat);
    bRoofLower.position.set(0, 5.5, 0); 
    bharatiGroup.add(bRoofLower);
    roofsRef.current.push(bRoofLower);

    const bRoofUpper = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.4, 12.2), roofMat);
    bRoofUpper.position.set(0, 9, 2); 
    bharatiGroup.add(bRoofUpper);
    roofsRef.current.push(bRoofUpper);

    const flagMesh1 = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), flagMat);
    flagMesh1.position.set(0, 7.25, 8.01);
    bharatiGroup.add(flagMesh1);

    [[-6, 7.5], [6, 7.5]].forEach(([px, pz]) => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 5.5, 16), stiltMat);
      pillar.position.set(px, 2.75, pz);
      bharatiGroup.add(pillar);
    });

    [[-6, -3], [6, -3], [-6, 2], [6, 2]].forEach(([sx, sz]) => {
      const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2, 16), stiltMat);
      stilt.position.set(sx, 1, sz);
      bharatiGroup.add(stilt);
    });

    addMachine('gen1', [0, 2.5, -2], [2.6, 2.0, 2.2], bharatiGroup, 'Diesel Gen'); 
    addMachine('water', [4, 6.5, 3], [2, 1.6, 2], bharatiGroup, 'Snow Melter'); 
    addMachine('hvac', [-4, 6.5, 3], [2.2, 1.8, 2.2], bharatiGroup, 'HVAC'); 
    
    const fuelPlatform = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 6), stiltMat);
    fuelPlatform.position.set(12, 1, 0);
    bharatiGroup.add(fuelPlatform);
    addMachine('fuel', [12, 2.2, 0], [3, 2, 4], bharatiGroup, 'External Fuel'); 

    // ================== MAITRI ==================
    const maitriGroup = new THREE.Group();
    maitriGroupRef.current = maitriGroup;
    scene.add(maitriGroup);

    const mTerrainGeo = new THREE.PlaneGeometry(150, 150, 64, 64).rotateX(-Math.PI / 2);
    const mPos = mTerrainGeo.attributes.position;
    for (let i = 0; i < mPos.count; i++) {
      const x = mPos.getX(i), z = mPos.getZ(i);
      const y = Math.sin(x * 0.08) * Math.cos(z * 0.08) * 3.5;
      mPos.setY(i, y);
    }
    mTerrainGeo.computeVertexNormals();
    maitriGroup.add(new THREE.Mesh(mTerrainGeo, new THREE.MeshStandardMaterial({ color: 0xa39b82, roughness: 1.0, flatShading: true })));

    const lake = new THREE.Mesh(new THREE.PlaneGeometry(80, 40).rotateX(-Math.PI/2), new THREE.MeshStandardMaterial({ color: 0x67e8f9, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.85 }));
    lake.position.set(0, -0.2, 25);
    maitriGroup.add(lake);

    const maitriY = 6; 

    const spine = buildHollowRoom(22, 3.5, 6, wallMat, floorMat);
    spine.position.set(0, maitriY, -8); 
    maitriGroup.add(spine);

    const lWing = buildHollowRoom(6, 3.5, 10, wallMat, floorMat);
    lWing.position.set(-8, maitriY, -0.5); 
    maitriGroup.add(lWing);

    const rWing = buildHollowRoom(6, 3.5, 10, wallMat, floorMat);
    rWing.position.set(8, maitriY, -0.5); 
    maitriGroup.add(rWing);

    const mRoofSpine = new THREE.Mesh(new THREE.BoxGeometry(22.2, 0.4, 6.2), roofMat);
    mRoofSpine.position.set(0, maitriY + 1.75, -8);
    maitriGroup.add(mRoofSpine);
    roofsRef.current.push(mRoofSpine);

    const mRoofL = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.4, 10.2), roofMat);
    mRoofL.position.set(-8, maitriY + 1.75, -0.5);
    maitriGroup.add(mRoofL);
    roofsRef.current.push(mRoofL);

    const mRoofR = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.4, 10.2), roofMat);
    mRoofR.position.set(8, maitriY + 1.75, -0.5);
    maitriGroup.add(mRoofR);
    roofsRef.current.push(mRoofR);

    const flagMesh2 = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), flagMat);
    flagMesh2.position.set(0, maitriY, -4.99);
    maitriGroup.add(flagMesh2);

    const addStilt = (x, z) => {
      const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, maitriY + 2, 16), stiltMat);
      stilt.position.set(x, maitriY / 2 - 1, z);
      maitriGroup.add(stilt);
    };
    [[-8, 3], [8, 3], [-8, -4], [8, -4], [0, -8], [-10, -8], [10, -8]].forEach(([px, pz]) => addStilt(px, pz));

    addMachine('gen1', [-8, maitriY - 0.5, 2], [2.4, 1.8, 2], maitriGroup, 'Gen'); 
    addMachine('water', [8, maitriY - 0.5, 2], [2, 1.4, 2], maitriGroup, 'Water'); 
    addMachine('hvac', [-3, maitriY - 0.5, -8], [2.2, 1.6, 2.2], maitriGroup, 'HVAC');
    
    // Fix: Moved Maitri Fuel tank inside the back spine room
    addMachine('fuel', [3, maitriY - 0.7, -8], [2.6, 1.8, 2], maitriGroup, 'Fuel');

    // ==========================================
    // Particles & Raycasting
    // ==========================================
    const pCount = isCompactViewport ? 900 : 3500;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i += 3) {
      pPos[i] = (Math.random() - 0.5) * 100;
      pPos[i+1] = Math.random() * 35;
      pPos[i+2] = (Math.random() - 0.5) * 100;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const snowParticles = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.8 }));
    scene.add(snowParticles);
    particlesRef.current = snowParticles;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const handlePointerDown = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      
      const activeTargets = clickableList.filter(m => m.parent.parent.visible);
      const intersects = raycaster.intersectObjects(activeTargets);
      if (intersects.length > 0) {
        if (onMachineClickRef.current) onMachineClickRef.current(intersects[0].object.userData.id);
      }
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      const speedMult = activeScenarioRef.current === 'BLIZZARD' ? 2.6 : 1.0;
      const positions = pGeo.attributes.position.array;
      for (let i = 1; i < pCount * 3; i += 3) {
        positions[i] -= 0.15 * speedMult;
        positions[i - 1] += 0.08 * speedMult;
        if (positions[i] < 0) positions[i] = 35;
        if (positions[i - 1] > 50) positions[i - 1] = -50;
      }
      pGeo.attributes.position.needsUpdate = true;

      roofsRef.current.forEach(roof => {
        if (!roof.parent.visible) return;
        const dist = camera.position.distanceTo(roof.position);
        roof.material.opacity = THREE.MathUtils.lerp(roof.material.opacity, dist < 22 ? 0.05 : 1.0, 0.08);
      });

      if (isTransitioning.current) {
        camera.position.lerp(targetCamPos.current, 0.05);
        controls.target.lerp(targetLookAt.current, 0.05);
        if (camera.position.distanceTo(targetCamPos.current) < 0.1) isTransitioning.current = false;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const nextWidth = Math.max(container.clientWidth, 1);
      const nextHeight = Math.max(container.clientHeight, 1);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []); 

  useEffect(() => {
    if (bharatiGroupRef.current && maitriGroupRef.current) {
      if (station === 'BHARATI_STATION') {
        bharatiGroupRef.current.visible = true;
        maitriGroupRef.current.visible = false;
        sceneRef.current.fog.density = 0.015;
        particlesRef.current.material.opacity = 0.8;
      } else {
        bharatiGroupRef.current.visible = false;
        maitriGroupRef.current.visible = true;
        sceneRef.current.fog.density = 0.008;
        particlesRef.current.material.opacity = 0.3;
      }
    }
  }, [station]);

  useEffect(() => {
    if (!machines) return;
    Object.entries(machines).forEach(([id, data]) => {
      const meshArray = machineMeshesRef.current[id];
      if (meshArray) {
        const isCrit = data.status === 'CRITICAL';
        const isWarn = data.status === 'WARNING';
        meshArray.forEach(item => {
          item.mesh.material.color.setHex(isCrit ? 0xff0055 : isWarn ? 0xffaa00 : 0x00d2ff);
          item.mesh.material.emissive.setHex(isCrit ? 0xaa0022 : isWarn ? 0x774400 : 0x002b40);
          item.ring.material.color.setHex(isCrit ? 0xff0055 : isWarn ? 0xffaa00 : 0x00d2ff);
        });
      }
    });
  }, [machines]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!selectedMachineId) return;

    if (selectedMachineId === 'overview') {
      targetCamPos.current = new THREE.Vector3(0, 18, 38);
      targetLookAt.current = new THREE.Vector3(0, 3, 0);
      isTransitioning.current = true;
      return;
    }
    
    const focusMap = {
      BHARATI_STATION: {
        gen1: { cam: new THREE.Vector3(-8, 9, 6), target: new THREE.Vector3(0, 2.5, -2) },
        water: { cam: new THREE.Vector3(12, 12, 10), target: new THREE.Vector3(4, 6.5, 3) },
        hvac: { cam: new THREE.Vector3(-12, 12, 10), target: new THREE.Vector3(-4, 6.5, 3) },
        fuel: { cam: new THREE.Vector3(18, 8, 6), target: new THREE.Vector3(12, 2.2, 0) },
      },
      MAITRI_STATION: {
        gen1: { cam: new THREE.Vector3(-14, 11, 10), target: new THREE.Vector3(-8, 5.5, 2) },
        water: { cam: new THREE.Vector3(14, 11, 10), target: new THREE.Vector3(8, 5.5, 2) },
        hvac: { cam: new THREE.Vector3(0, 11, 0), target: new THREE.Vector3(0, 5.5, -8) },
        fuel: { cam: new THREE.Vector3(0, 10, -2), target: new THREE.Vector3(0, 5.3, -9.5) },
      }
    };

    const activeMap = focusMap[station];
    if (activeMap && activeMap[selectedMachineId]) {
      targetCamPos.current = activeMap[selectedMachineId].cam;
      targetLookAt.current = activeMap[selectedMachineId].target;
      isTransitioning.current = true;
    }
  }, [selectedMachineId, station]);

  return <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />;
}