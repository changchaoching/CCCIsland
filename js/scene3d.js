// site/js/scene3d.js
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class SceneManager {
  constructor(container, labelContainer, onIslandClick) {
    this.container = container;
    this.labelContainer = labelContainer;
    this.onIslandClick = onIslandClick;
    
    this.isReducedMotion = false;
    this.dayNightCycle = "day"; // "day", "sunset", "night"
    this.currentTheme = "sky";
    
    this.islands = [];
    this.islandMeshes = new Map();
    this.islandLabels = new Map();
    this.pedestrians = [];
    this.animatingCamera = false;
    
    this.init();
  }

  init() {
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch (e) {
      console.warn("WebGL not supported:", e);
      throw new Error("WEBGL_UNAVAILABLE");
    }

    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xeaf4fb, 0.015);

    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.5, 400);
    this.defaultCameraPos = new THREE.Vector3(0, 36, 48);
    this.defaultCameraTarget = new THREE.Vector3(0, 0, 0);
    this.camera.position.copy(this.defaultCameraPos);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 110;
    this.controls.target.copy(this.defaultCameraTarget);

    this.setupLighting();
    this.setupOcean();

    window.addEventListener("resize", () => this.onResize());
    this.setupRaycasting();

    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7e6, 1.2);
    this.sunLight.position.set(30, 45, 20);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 150;
    const d = 40;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e3a8a, 0.4);
    this.scene.add(this.hemiLight);
  }

  setupOcean() {
    const oceanGeo = new THREE.PlaneGeometry(350, 350, 48, 48);
    this.oceanMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.25,
      metalness: 0.1,
      flatShading: true,
      transparent: true,
      opacity: 0.88
    });
    this.ocean = new THREE.Mesh(oceanGeo, this.oceanMat);
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.y = -0.4;
    this.ocean.receiveShadow = true;
    this.scene.add(this.ocean);

    const seaFloorGeo = new THREE.PlaneGeometry(350, 350);
    const seaFloorMat = new THREE.MeshBasicMaterial({ color: 0x0c4a6e });
    const seaFloor = new THREE.Mesh(seaFloorGeo, seaFloorMat);
    seaFloor.rotation.x = -Math.PI / 2;
    seaFloor.position.y = -3.5;
    this.scene.add(seaFloor);
  }

  loadIslands(data) {
    this.islandData = [data.centerIsland, ...data.islands];
    
    this.islands.forEach(group => this.scene.remove(group));
    this.islands = [];
    this.islandMeshes.clear();
    this.labelContainer.innerHTML = "";
    this.islandLabels.clear();
    this.pedestrians = [];

    this.islandData.forEach(item => {
      const isCenter = item.id === "island-center";
      const group = new THREE.Group();
      group.position.set(item.position.x, 0, item.position.z);
      group.userData = { id: item.id, name: item.name, data: item };

      const radius = item.position.radius || 5;
      const baseMesh = this.createIslandBase(radius, item.color, isCenter);
      group.add(baseMesh);

      const landmarkGroup = this.createLandmark(item);
      group.add(landmarkGroup);

      this.populateVegetation(group, radius, isCenter);
      this.setupIslandPedestrians(group, radius, isCenter);

      if (!isCenter) {
        this.createCauseway(item.position.x, item.position.z);
      }

      this.scene.add(group);
      this.islands.push(group);
      this.islandMeshes.set(item.id, group);

      this.createIslandTag(item);
    });

    this.createBoats();
  }

  createIslandBase(radius, themeColor, isCenter) {
    const group = new THREE.Group();
    const segments = isCenter ? 12 : 9;
    const islandGeo = new THREE.CylinderGeometry(radius, radius * 1.15, 2.2, segments, 2);
    const pos = islandGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y > 0) {
        pos.setY(i, y + (Math.sin(pos.getX(i) * 2) * 0.25));
      }
    }
    islandGeo.computeVertexNormals();

    const grassMat = new THREE.MeshStandardMaterial({
      color: isCenter ? 0x6ee7b7 : 0x86efac,
      roughness: 0.8,
      flatShading: true
    });
    const grassMesh = new THREE.Mesh(islandGeo, grassMat);
    grassMesh.position.y = 0.7;
    grassMesh.castShadow = true;
    grassMesh.receiveShadow = true;
    group.add(grassMesh);

    const sandGeo = new THREE.CylinderGeometry(radius * 1.16, radius * 1.35, 1.4, segments);
    sandGeo.computeVertexNormals();
    const sandMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.9,
      flatShading: true
    });
    const sandMesh = new THREE.Mesh(sandGeo, sandMat);
    sandMesh.position.y = -0.5;
    sandMesh.receiveShadow = true;
    group.add(sandMesh);

    return group;
  }

  createLandmark(item) {
    const group = new THREE.Group();
    group.position.y = 1.8;

    switch (item.id) {
      case "island-center": {
        const baseBox = new THREE.Mesh(
          new THREE.CylinderGeometry(3.6, 4.0, 0.6, 8),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, flatShading: true })
        );
        baseBox.position.y = 0.3;
        baseBox.receiveShadow = true;
        group.add(baseBox);

        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const col = new THREE.Mesh(
            new THREE.CylinderGeometry(0.18, 0.18, 2.8, 6),
            new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
          );
          col.position.set(Math.cos(angle) * 2.2, 1.7, Math.sin(angle) * 2.2);
          col.castShadow = true;
          group.add(col);
        }

        const crystalGeo = new THREE.IcosahedronGeometry(1.6, 0);
        this.centerCrystalMat = new THREE.MeshStandardMaterial({
          color: 0x3b82f6,
          emissive: 0x1d4ed8,
          emissiveIntensity: 0.4,
          roughness: 0.1,
          metalness: 0.3,
          flatShading: true
        });
        this.centerCrystal = new THREE.Mesh(crystalGeo, this.centerCrystalMat);
        this.centerCrystal.position.y = 4.2;
        this.centerCrystal.castShadow = true;
        group.add(this.centerCrystal);

        const ringGeo = new THREE.TorusGeometry(2.6, 0.12, 8, 24);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.5 });
        this.centerRing = new THREE.Mesh(ringGeo, ringMat);
        this.centerRing.position.y = 4.2;
        this.centerRing.rotation.x = Math.PI / 3;
        group.add(this.centerRing);
        break;
      }
      case "island-01": {
        const amphitheatre = new THREE.Group();
        for (let tier = 0; tier < 3; tier++) {
          const arcGeo = new THREE.CylinderGeometry(2.4 - tier * 0.5, 2.5 - tier * 0.5, 0.35, 12, 1, false, 0, Math.PI * 1.4);
          const arcMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.5, flatShading: true });
          const arc = new THREE.Mesh(arcGeo, arcMat);
          arc.position.y = tier * 0.38;
          amphitheatre.add(arc);
        }
        const podium = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 0.8, 0.4),
          new THREE.MeshStandardMaterial({ color: 0x0284c7 })
        );
        podium.position.set(0.6, 0.4, 0.2);
        amphitheatre.add(podium);
        group.add(amphitheatre);
        break;
      }
      case "island-02": {
        const factory = new THREE.Group();
        const bldg = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 1.8, 2.0),
          new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5, flatShading: true })
        );
        bldg.position.y = 0.9;
        bldg.castShadow = true;
        factory.add(bldg);

        const chimney1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x7c2d12 }));
        chimney1.position.set(0.5, 2.2, 0.5);
        factory.add(chimney1);

        const gearGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.2, 8);
        this.factoryGear = new THREE.Mesh(gearGeo, new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.4 }));
        this.factoryGear.rotation.x = Math.PI / 2;
        this.factoryGear.position.set(-1.2, 1.1, 0);
        factory.add(this.factoryGear);

        const belt = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.15, 0.7), new THREE.MeshStandardMaterial({ color: 0x334155 }));
        belt.position.set(0, 0.1, 1.4);
        factory.add(belt);
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
        box.position.set(0.2, 0.35, 1.4);
        factory.add(box);
        group.add(factory);
        break;
      }
      case "island-03": {
        const mobiusTower = new THREE.Group();
        const baseCyl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 0.8, 8), new THREE.MeshStandardMaterial({ color: 0x7c3aed }));
        mobiusTower.add(baseCyl);

        const loop1 = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.15, 8, 20), new THREE.MeshStandardMaterial({ color: 0xa78bfa, emissive: 0x6d28d9, emissiveIntensity: 0.3 }));
        loop1.position.y = 2.0;
        loop1.rotation.x = Math.PI / 4;
        mobiusTower.add(loop1);

        const loop2 = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.15, 8, 20), new THREE.MeshStandardMaterial({ color: 0xc4b5fd, emissive: 0x7c3aed, emissiveIntensity: 0.3 }));
        loop2.position.y = 2.0;
        loop2.rotation.y = Math.PI / 3;
        loop2.rotation.z = Math.PI / 4;
        mobiusTower.add(loop2);

        this.techTowerLoops = [loop1, loop2];
        group.add(mobiusTower);
        break;
      }
      case "island-04": {
        const cubeTemple = new THREE.Group();
        const colors = [0x10b981, 0x059669, 0x34d399, 0x6ee7b7, 0x047857, 0xa7f3d0];
        for (let x = 0; x < 2; x++) {
          for (let y = 0; y < 2; y++) {
            for (let z = 0; z < 2; z++) {
              const block = new THREE.Mesh(
                new THREE.BoxGeometry(0.7, 0.7, 0.7),
                new THREE.MeshStandardMaterial({
                  color: colors[(x * 4 + y * 2 + z) % colors.length],
                  roughness: 0.3,
                  flatShading: true
                })
              );
              block.position.set((x - 0.5) * 0.78, 1.2 + (y - 0.5) * 0.78, (z - 0.5) * 0.78);
              cubeTemple.add(block);
            }
          }
        }
        group.add(cubeTemple);
        break;
      }
      case "island-05": {
        const lighthouse = new THREE.Group();
        const towerMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.6, 1.0, 3.2, 6),
          new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.4, flatShading: true })
        );
        towerMesh.position.y = 1.6;
        towerMesh.castShadow = true;
        lighthouse.add(towerMesh);

        const lightHouseTop = new THREE.Mesh(
          new THREE.ConeGeometry(0.8, 0.8, 6),
          new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2 })
        );
        lightHouseTop.position.y = 3.6;
        lighthouse.add(lightHouseTop);

        const beamGeo = new THREE.ConeGeometry(1.6, 4.0, 6);
        this.lighthouseBeam = new THREE.Mesh(
          beamGeo,
          new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.35 })
        );
        this.lighthouseBeam.position.set(0, 3.2, 2.0);
        this.lighthouseBeam.rotation.x = Math.PI / 2;
        lighthouse.add(this.lighthouseBeam);
        group.add(lighthouse);
        break;
      }
      case "island-06": {
        const pantheon = new THREE.Group();
        const arenaFloor = new THREE.Mesh(
          new THREE.CylinderGeometry(2.2, 2.4, 0.25, 12),
          new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.6 })
        );
        arenaFloor.position.y = 0.12;
        pantheon.add(arenaFloor);

        for (let i = 0; i < 9; i++) {
          const angle = (i / 9) * Math.PI * 2;
          const colPillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.16, 2.0, 6),
            new THREE.MeshStandardMaterial({ color: 0xeab308, emissive: 0xca8a04, emissiveIntensity: 0.2 })
          );
          colPillar.position.set(Math.cos(angle) * 1.8, 1.1, Math.sin(angle) * 1.8);
          colPillar.castShadow = true;
          pantheon.add(colPillar);
        }
        group.add(pantheon);
        break;
      }
      case "island-07": {
        const market = new THREE.Group();
        const tentColors = [0x06b6d4, 0x3b82f6, 0xf59e0b, 0x10b981];
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const tent = new THREE.Mesh(
            new THREE.ConeGeometry(0.7, 0.9, 4),
            new THREE.MeshStandardMaterial({ color: tentColors[i], flatShading: true })
          );
          tent.position.set(Math.cos(angle) * 1.5, 0.5, Math.sin(angle) * 1.5);
          market.add(tent);
        }
        const scalePole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6), new THREE.MeshStandardMaterial({ color: 0x475569 }));
        scalePole.position.y = 0.9;
        market.add(scalePole);
        const scaleBeam = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0x475569 }));
        scaleBeam.position.y = 1.6;
        market.add(scaleBeam);
        group.add(market);
        break;
      }
    }

    return group;
  }

  populateVegetation(group, radius, isCenter) {
    const treeCount = isCenter ? 8 : 4;
    const treeGeo = new THREE.ConeGeometry(0.45, 1.1, 5);
    const treeTrunkGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.4, 5);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8, flatShading: true });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });

    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2 + (Math.random() * 0.4);
      const dist = (radius * 0.55) + (Math.random() * radius * 0.25);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(treeTrunkGeo, trunkMat);
      trunk.position.y = 0.2;
      const leaves = new THREE.Mesh(treeGeo, leavesMat);
      leaves.position.y = 0.8;
      leaves.castShadow = true;
      treeGroup.add(trunk, leaves);
      treeGroup.position.set(x, 1.7, z);
      treeGroup.scale.setScalar(0.7 + Math.random() * 0.5);
      group.add(treeGroup);
    }
  }

  setupIslandPedestrians(group, radius, isCenter) {
    const isMobile = window.innerWidth < 768;
    const count = isMobile ? (isCenter ? 2 : 1) : (isCenter ? 4 : 2);

    for (let i = 0; i < count; i++) {
      const p = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.16, 0.45, 5),
        new THREE.MeshStandardMaterial({ color: Math.random() > 0.5 ? 0x2563eb : 0xec4899 })
      );
      body.position.y = 0.3;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0xfde047 })
      );
      head.position.y = 0.6;
      p.add(body, head);
      group.add(p);

      this.pedestrians.push({
        mesh: p,
        center: new THREE.Vector3(0, 1.8, 0),
        orbitRadius: radius * 0.6 + Math.random() * (radius * 0.2),
        speed: (0.35 + Math.random() * 0.3) * (Math.random() > 0.5 ? 1 : -1),
        angle: Math.random() * Math.PI * 2
      });
    }
  }

  createCauseway(fromX, fromZ) {
    const pathPoints = [
      new THREE.Vector3(fromX * 0.8, 0.1, fromZ * 0.8),
      new THREE.Vector3(fromX * 0.4, 0.15, fromZ * 0.4),
      new THREE.Vector3(0, 0.2, 0)
    ];
    const curve = new THREE.CatmullRomCurve3(pathPoints);
    const bridgeGeo = new THREE.TubeGeometry(curve, 12, 0.25, 4, false);
    const bridgeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.7,
      flatShading: true
    });
    const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
    bridge.receiveShadow = true;
    this.scene.add(bridge);
  }

  createBoats() {
    this.boats = [];
    for (let i = 0; i < 3; i++) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.35, 1.6),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
      );
      hull.position.y = 0.15;
      const sail = new THREE.Mesh(
        new THREE.ConeGeometry(0.6, 1.2, 3),
        new THREE.MeshStandardMaterial({ color: 0xf43f5e, flatShading: true })
      );
      sail.position.set(0, 0.9, -0.1);
      sail.rotation.y = Math.PI / 2;
      boat.add(hull, sail);
      this.scene.add(boat);

      this.boats.push({
        mesh: boat,
        radius: 26 + i * 8,
        angle: (i / 3) * Math.PI * 2,
        speed: 0.08 + i * 0.02
      });
    }
  }

  createIslandTag(item) {
    const isCenter = item.id === "island-center";
    const tag = document.createElement("button");
    tag.className = "island-3d-tag" + (isCenter ? " center-tag" : "");
    tag.setAttribute("aria-label", "開啟島嶼：" + item.name);
    
    const badgeText = isCenter ? "★" : item.order;
    const groupText = item.group || "總覽";
    tag.innerHTML = "<span class=\"order-badge\">" + badgeText + "</span><span class=\"tag-title\">" + item.name + "</span><span class=\"tag-group\">" + groupText + "</span>";

    tag.addEventListener("click", () => {
      this.focusIsland(item.id);
      if (this.onIslandClick) {
        this.onIslandClick(item.id);
      }
    });

    this.labelContainer.appendChild(tag);
    this.islandLabels.set(item.id, {
      element: tag,
      position: new THREE.Vector3(item.position.x, 4.8, item.position.z)
    });
  }

  updateLabels() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const halfW = width / 2;
    const halfH = height / 2;

    this.islandLabels.forEach(({ element, position }) => {
      const screenPos = position.clone().project(this.camera);

      if (screenPos.z > 1) {
        element.style.display = "none";
        return;
      }

      element.style.display = "flex";
      const x = (screenPos.x * halfW) + halfW;
      const y = -(screenPos.y * halfH) + halfH;
      element.style.left = x + "px";
      element.style.top = y + "px";
    });
  }

  setupRaycasting() {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.container.addEventListener("pointerdown", (e) => {
      this.pointerDownTime = Date.now();
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    this.container.addEventListener("pointerup", (e) => {
      const moveDist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (Date.now() - this.pointerDownTime < 350 && moveDist < 6) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.islands, true);

        if (intersects.length > 0) {
          let target = intersects[0].object;
          while (target && !target.userData?.id && target.parent) {
            target = target.parent;
          }
          if (target && target.userData?.id) {
            const islandId = target.userData.id;
            this.focusIsland(islandId);
            if (this.onIslandClick) {
              this.onIslandClick(islandId);
            }
          }
        }
      }
    });
  }

  focusIsland(id) {
    const mesh = this.islandMeshes.get(id);
    if (!mesh) return;

    const targetPos = mesh.position.clone();
    const isMobile = window.innerWidth < 768;
    const distanceOffset = isMobile ? 12 : 10;
    
    const camTarget = new THREE.Vector3(
      targetPos.x + distanceOffset * 0.7,
      targetPos.y + 7.5,
      targetPos.z + distanceOffset * 0.9
    );

    this.animateCameraTo(camTarget, targetPos.clone().add(new THREE.Vector3(0, 1.8, 0)));
  }

  resetView() {
    this.animateCameraTo(this.defaultCameraPos, this.defaultCameraTarget);
  }

  animateCameraTo(targetCamPos, targetLookAt) {
    if (this.isReducedMotion) {
      this.camera.position.copy(targetCamPos);
      this.controls.target.copy(targetLookAt);
      this.controls.update();
      return;
    }

    this.animatingCamera = true;
    const startCamPos = this.camera.position.clone();
    const startLookAt = this.controls.target.clone();
    const startTime = performance.now();
    const duration = 1000;

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      this.camera.position.lerpVectors(startCamPos, targetCamPos, ease);
      this.controls.target.lerpVectors(startLookAt, targetLookAt, ease);
      this.controls.update();

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        this.animatingCamera = false;
      }
    };
    requestAnimationFrame(step);
  }

  setDayNight(cycle) {
    this.dayNightCycle = cycle;
    if (cycle === "day") {
      this.sunLight.intensity = 1.2;
      this.sunLight.color.setHex(0xfff7e6);
      this.sunLight.position.set(30, 45, 20);
      this.ambientLight.intensity = 0.65;
      if (this.lighthouseBeam) this.lighthouseBeam.visible = false;
    } else if (cycle === "sunset") {
      this.sunLight.intensity = 1.4;
      this.sunLight.color.setHex(0xf97316);
      this.sunLight.position.set(45, 12, 10);
      this.ambientLight.intensity = 0.45;
      this.ambientLight.color.setHex(0xfde047);
      if (this.lighthouseBeam) this.lighthouseBeam.visible = true;
    } else if (cycle === "night") {
      this.sunLight.intensity = 0.25;
      this.sunLight.color.setHex(0x60a5fa);
      this.sunLight.position.set(-20, 30, -20);
      this.ambientLight.intensity = 0.25;
      this.ambientLight.color.setHex(0x1e3a8a);
      if (this.lighthouseBeam) this.lighthouseBeam.visible = true;
    }
  }

  setTheme(theme) {
    this.currentTheme = theme;
    let bgColor = 0xeaf4fb;
    let oceanColor = 0x38bdf8;

    if (theme === "cloud") {
      bgColor = 0xf7f9fb;
      oceanColor = 0x60a5fa;
    } else if (theme === "night") {
      bgColor = 0x121c2e;
      oceanColor = 0x1e293b;
    }

    this.scene.fog.color.setHex(bgColor);
    this.oceanMat.color.setHex(oceanColor);

    if (theme === "night" && this.dayNightCycle === "day") {
      this.setDayNight("night");
    } else if (theme !== "night" && this.dayNightCycle === "night") {
      this.setDayNight("day");
    }
  }

  setReducedMotion(reduced) {
    this.isReducedMotion = reduced;
  }

  onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(this.animate);
    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    this.controls.update();

    if (!this.isReducedMotion) {
      if (this.centerCrystal) {
        this.centerCrystal.rotation.y += 0.015;
        this.centerCrystal.rotation.x = Math.sin(time * 0.8) * 0.15;
      }
      if (this.centerRing) {
        this.centerRing.rotation.z += 0.02;
      }

      if (this.factoryGear) {
        this.factoryGear.rotation.z += 0.03;
      }

      if (this.techTowerLoops) {
        this.techTowerLoops[0].rotation.z += 0.02;
        this.techTowerLoops[1].rotation.x += 0.018;
      }

      if (this.lighthouseBeam && this.lighthouseBeam.visible) {
        this.lighthouseBeam.parent.rotation.y += 0.025;
      }

      this.pedestrians.forEach(p => {
        p.angle += p.speed * delta;
        p.mesh.position.x = p.center.x + Math.cos(p.angle) * p.orbitRadius;
        p.mesh.position.z = p.center.z + Math.sin(p.angle) * p.orbitRadius;
        p.mesh.position.y = p.center.y + Math.abs(Math.sin(time * 6 * Math.abs(p.speed))) * 0.08;
        p.mesh.rotation.y = -p.angle + (p.speed > 0 ? -Math.PI / 2 : Math.PI / 2);
      });

      if (this.boats) {
        this.boats.forEach(b => {
          b.angle += b.speed * delta;
          b.mesh.position.x = Math.cos(b.angle) * b.radius;
          b.mesh.position.z = Math.sin(b.angle) * b.radius;
          b.mesh.rotation.y = -b.angle + Math.PI / 2;
          b.mesh.position.y = Math.sin(time * 2 + b.radius) * 0.1;
        });
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  }
}
