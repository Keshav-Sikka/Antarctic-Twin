import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';

export default function ThreeScene({ machines, selectedMachineId, onMachineClick, activeScenario }) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const machineMeshesRef = useRef({});
  const roofMeshRef = useRef(null);
  
  // Camera Transition State
  const targetCamPos = useRef(new THREE.Vector3(0, 16, 28));
  const targetLookAt = useRef(new THREE.Vector3(0, 3, 0));
  const isTransitioning = useRef(false);
  const isFirstRender = useRef(true);

  // Mutable refs for callbacks and dynamic state to avoid re-triggering useEffect
  const onMachineClickRef = useRef(onMachineClick);
  const activeScenarioRef = useRef(activeScenario);

  useEffect(() => { onMachineClickRef.current = onMachineClick; }, [onMachineClick]);
  useEffect(() => { activeScenarioRef.current = activeScenario; }, [activeScenario]);

  // SCENE INITIALIZATION (RUNS STRICTLY ONCE)
  useEffect(() => {
    const container = mountRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0a111e);
    scene.fog = new THREE.FogExp2(0x0e1726, 0.018);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 16, 32); 
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.03; 
    controls.minDistance = 5;
    controls.maxDistance = 60;
    controls.target.set(0, 3, 0);
    controlsRef.current = controls;

    controls.addEventListener('start', () => { isTransitioning.current = false; });

    // Lights
    scene.add(new THREE.AmbientLight(0xe0f2fe, 0.95));
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunLight.position.set(20, 35, 15);
    scene.add(sunLight);

    // Terrain
    const terrainGeo = new THREE.PlaneGeometry(150, 150, 90, 90);
    terrainGeo.rotateX(-Math.PI / 2);
    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      posAttr.setY(i, Math.sqrt(x * x + z * z) > 16 ? Math.max(0, Math.sin(x * 0.1) * Math.cos(z * 0.1) * 6.5 + Math.sin(x * 0.22 + z * 0.18) * 3.8) : 0);
    }
    terrainGeo.computeVertexNormals();
    const terrainMesh = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9, flatShading: true }));
    terrainMesh.position.y = -0.1;
    scene.add(terrainMesh);

    // Station
    const stationGroup = new THREE.Group();
    const stiltMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.3 });
    [[-6, -3], [6, -3], [-6, 3], [6, 3]].forEach(([sx, sz]) => {
      const stilt = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.8, 16), stiltMat);
      stilt.position.set(sx, 1.9, sz);
      stationGroup.add(stilt);
    });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.8, 10.2), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 }));
    floor.position.y = 3.6;
    stationGroup.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.4, roughness: 0.35 });
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(16.2, 3.2, 0.4), wallMat); frontWall.position.set(0, 5.4, 4.9);
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(16.2, 3.2, 0.4), wallMat); backWall.position.set(0, 5.4, -4.9);
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.2, 10.2), wallMat); leftWall.position.set(-7.9, 5.4, 0);
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.2, 10.2), wallMat); rightWall.position.set(7.9, 5.4, 0);
    stationGroup.add(frontWall, backWall, leftWall, rightWall);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.4, 10.4), new THREE.MeshStandardMaterial({ color: 0xcfd8dc, transparent: true }));
    roof.position.y = 7.1;
    stationGroup.add(roof);
    roofMeshRef.current = roof;

    // Machines
    const clickableList = [];
    [{ id: 'gen1', pos: [-4.5, 4.7, -2], size: [2.4, 1.6, 2.2] },
     { id: 'fuel', pos: [4.5, 4.9, -2], size: [2.6, 2.0, 2.4] },
     { id: 'water', pos: [-4.5, 4.6, 2], size: [2.2, 1.4, 2.0] },
     { id: 'hvac', pos: [4.5, 4.8, 2], size: [2.4, 1.8, 2.2] }].forEach((cfg) => {
      const mGroup = new THREE.Group();
      mGroup.position.set(...cfg.pos);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...cfg.size), new THREE.MeshStandardMaterial({ color: 0x00d2ff, metalness: 0.8, roughness: 0.2 }));
      mesh.userData = { id: cfg.id };
      mGroup.add(mesh);
      
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.25, 32).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({ color: 0x00d2ff, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
      ring.position.y = cfg.size[1] / 2 + 0.15;
      mGroup.add(ring);
      
      stationGroup.add(mGroup);
      machineMeshesRef.current[cfg.id] = { mesh, ring };
      clickableList.push(mesh);
    });
    scene.add(stationGroup);

    // Blizzard
    const pCount = 3800;
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i += 3) {
      pPos[i] = (Math.random() - 0.5) * 85;
      pPos[i+1] = Math.random() * 32;
      pPos[i+2] = (Math.random() - 0.5) * 85;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    scene.add(new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0.9 })));

    // Raycasting
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const handlePointerDown = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(clickableList);
      if (intersects.length > 0) {
        if (onMachineClickRef.current) onMachineClickRef.current(intersects[0].object.userData.id);
      }
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    // Render Loop
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      const speedMult = activeScenarioRef.current === 'BLIZZARD' ? 2.6 : 1.0;
      const positions = pGeo.attributes.position.array;
      for (let i = 1; i < pCount * 3; i += 3) {
        positions[i] -= 0.15 * speedMult;
        positions[i - 1] += 0.09 * speedMult;
        if (positions[i] < 0) positions[i] = 32;
        if (positions[i - 1] > 42) positions[i - 1] = -42;
      }
      pGeo.attributes.position.needsUpdate = true;

      if (roofMeshRef.current) {
        roofMeshRef.current.material.opacity = THREE.MathUtils.lerp(
          roofMeshRef.current.material.opacity, 
          camera.position.distanceTo(new THREE.Vector3(0, 5, 0)) < 18 ? 0.05 : 1.0, 
          0.08
        );
      }

      if (isTransitioning.current) {
        camera.position.lerp(targetCamPos.current, 0.05);
        controls.target.lerp(targetLookAt.current, 0.05);
        if (camera.position.distanceTo(targetCamPos.current) < 0.1) isTransitioning.current = false;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []); // <-- EMPTY DEPENDENCY ARRAY PREVENTS TEARDOWN

  // Color Sync
  useEffect(() => {
    if (!machines) return;
    Object.entries(machines).forEach(([id, data]) => {
      const item = machineMeshesRef.current[id];
      if (item) {
        const isCrit = data.status === 'CRITICAL';
        const isWarn = data.status === 'WARNING';
        item.mesh.material.color.setHex(isCrit ? 0xff0055 : isWarn ? 0xffaa00 : 0x00d2ff);
        item.mesh.material.emissive.setHex(isCrit ? 0xaa0022 : isWarn ? 0x774400 : 0x002b40);
        item.ring.material.color.setHex(isCrit ? 0xff0055 : isWarn ? 0xffaa00 : 0x00d2ff);
      }
    });
  }, [machines]);

  // Handle Machine Carousel Focus
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!selectedMachineId) return;
    
    const focusPositions = {
      gen1: { cam: new THREE.Vector3(-8, 9, 3), target: new THREE.Vector3(-4.5, 4.7, -2) },
      fuel: { cam: new THREE.Vector3(8, 9, 3), target: new THREE.Vector3(4.5, 4.9, -2) },
      water: { cam: new THREE.Vector3(-8, 9, 7), target: new THREE.Vector3(-4.5, 4.6, 2) },
      hvac: { cam: new THREE.Vector3(8, 9, 7), target: new THREE.Vector3(4.5, 4.8, 2) },
    };

    if (focusPositions[selectedMachineId]) {
      targetCamPos.current = focusPositions[selectedMachineId].cam;
      targetLookAt.current = focusPositions[selectedMachineId].target;
      isTransitioning.current = true;
    }
  }, [selectedMachineId]);

  return <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />;
}