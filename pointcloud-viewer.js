import * as THREE from "./assets/vendor/three.module.js";
import { OrbitControls } from "./assets/vendor/OrbitControls.js";

const rgbThumbs = (tag, cams) =>
  cams.map((cam) => `assets/images/pcd_ctx/${tag}/rgb_${cam}.jpg`);
const FISHEYE4 = ["CAM_A", "CAM_B", "CAM_C", "CAM_D"];
const HETERO6 = ["CAM_A", "CAM_B", "CAM_C", "CAM_D", "CAM_Front", "CAM_Back"];

const CLOUDS = [
  {
    name: "Real Capture 1",
    url: "assets/pointclouds/1780394583405367087.ply",
    tag: "Real scene",
    thumbs: rgbThumbs("real1", FISHEYE4),
  },
  {
    name: "Real Capture 2",
    url: "assets/pointclouds/1780395677253282878.ply",
    tag: "Real scene",
    thumbs: rgbThumbs("real2", FISHEYE4),
  },
  {
    name: "Swimming Pool",
    url: "assets/pointclouds/swimmingpool.ply",
    tag: "Hetero scene",
    thumbs: rgbThumbs("swimmingpool", HETERO6),
  },
];

const TYPE_BYTES = {
  char: 1,
  uchar: 1,
  int8: 1,
  uint8: 1,
  short: 2,
  ushort: 2,
  int16: 2,
  uint16: 2,
  int: 4,
  uint: 4,
  int32: 4,
  uint32: 4,
  float: 4,
  float32: 4,
  double: 8,
  float64: 8,
};

const TYPE_READERS = {
  char: "getInt8",
  uchar: "getUint8",
  int8: "getInt8",
  uint8: "getUint8",
  short: "getInt16",
  ushort: "getUint16",
  int16: "getInt16",
  uint16: "getUint16",
  int: "getInt32",
  uint: "getUint32",
  int32: "getInt32",
  uint32: "getUint32",
  float: "getFloat32",
  float32: "getFloat32",
  double: "getFloat64",
  float64: "getFloat64",
};

const canvas = document.getElementById("pointcloudCanvas");
const viewer = document.getElementById("pointcloudViewer");
const statusEl = document.getElementById("pointcloudStatus");
const nameEl = document.getElementById("pointcloudName");
const prevBtn = document.getElementById("pointcloudPrev");
const nextBtn = document.getElementById("pointcloudNext");

let clearMeasureRef = () => {};
let resetBtnRef = null;

if (canvas && viewer) {
  initPointCloudViewer();
}

function initPointCloudViewer() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050309);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  camera.position.set(0, 0.2, 2.8);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.8;

  const ambient = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambient);

  let activeIndex = 0;
  let activePoints = null;
  const resize = () => {
    const { width, height } = viewer.getBoundingClientRect();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const ro = new ResizeObserver(resize);
  ro.observe(viewer);
  resize();

  const showCloud = async (index) => {
    activeIndex = (index + CLOUDS.length) % CLOUDS.length;
    const cloud = CLOUDS[activeIndex];
    nameEl.textContent = cloud.name;
    updateContext(cloud);
    clearMeasureRef();
    setStatus("Loading point cloud...");

    try {
      const original = await loadGeometry(cloud);
      if (activePoints) {
        scene.remove(activePoints);
        activePoints.geometry.dispose();
      }

      const material = new THREE.PointsMaterial({
        size: 0.006,
        vertexColors: true,
        sizeAttenuation: true,
      });

      // Work on a clone so cropping never corrupts the cached original.
      const working = original.clone();
      working.userData.metricScale = original.userData.metricScale;
      activePoints = new THREE.Points(working, material);
      scene.add(activePoints);
      frameGeometry(working, camera, controls);
      if (resetBtnRef) resetBtnRef.hidden = true;
      setStatus("");
    } catch (error) {
      console.error(error);
      setStatus("Point cloud failed to load");
    }
  };

  prevBtn.addEventListener("click", () => showCloud(activeIndex - 1));
  nextBtn.addEventListener("click", () => showCloud(activeIndex + 1));

  // ---- metric distance measurement: pick two points, read out meters ----
  const measureBtn = document.getElementById("pcMeasureBtn");
  const measureChip = document.getElementById("pcMeasureChip");
  const raycaster = new THREE.Raycaster();
  const measureGroup = new THREE.Group();
  scene.add(measureGroup);
  let measuring = false;
  let picked = [];
  let downAt = null;

  const setChip = (text) => {
    if (!measureChip) return;
    measureChip.hidden = !text;
    measureChip.textContent = text || "";
  };

  const clearMeasure = () => {
    picked = [];
    while (measureGroup.children.length) {
      const c = measureGroup.children.pop();
      c.geometry?.dispose();
      c.material?.dispose();
    }
    if (measuring) setChip("Click two points on the cloud");
    else setChip("");
  };
  clearMeasureRef = clearMeasure;

  const markerAt = (p, radius) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xd946ef, depthTest: false })
    );
    m.position.copy(p);
    m.renderOrder = 2;
    measureGroup.add(m);
  };

  const pick = (event) => {
    if (!activePoints) return;
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const radius = activePoints.geometry.boundingSphere?.radius || 0.8;
    raycaster.params.Points.threshold = radius * 0.014;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(activePoints, false);
    if (!hits.length) return;
    const point = hits[0].point.clone();

    if (picked.length === 2) clearMeasure();
    picked.push(point);
    markerAt(point, radius * 0.012);

    if (picked.length === 1) {
      setChip("Now click a second point");
    } else {
      const lineGeo = new THREE.BufferGeometry().setFromPoints(picked);
      const line = new THREE.Line(
        lineGeo,
        new THREE.LineBasicMaterial({ color: 0xd946ef, depthTest: false })
      );
      line.renderOrder = 1;
      measureGroup.add(line);
      const meters =
        picked[0].distanceTo(picked[1]) *
        (activePoints.geometry.userData.metricScale || 1);
      setChip(`${meters.toFixed(2)} m`);
    }
  };

  if (measureBtn) {
    measureBtn.addEventListener("click", () => {
      measuring = !measuring;
      if (measuring) setCropMode(false); // modes are mutually exclusive
      measureBtn.setAttribute("aria-pressed", String(measuring));
      measureBtn.classList.toggle("active", measuring);
      canvas.style.cursor = measuring ? "crosshair" : "";
      clearMeasure();
    });
  }

  canvas.addEventListener("pointerdown", (e) => {
    downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!measuring || !downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    const dt = performance.now() - downAt.t;
    downAt = null;
    if (moved < 6 && dt < 500) pick(e); // click, not an orbit drag
  });

  // ---- box-select crop: drag a rectangle, points inside are removed ----
  const cropBtn = document.getElementById("pcCropBtn");
  const resetBtn = document.getElementById("pcResetBtn");
  const cropRectEl = document.getElementById("pcCropRect");
  resetBtnRef = resetBtn;
  let cropping = false;
  let dragStart = null;

  const setCropMode = (on) => {
    cropping = on;
    controls.enabled = !on;
    canvas.style.cursor = on ? "crosshair" : measuring ? "crosshair" : "";
    if (cropBtn) {
      cropBtn.classList.toggle("active", on);
      cropBtn.setAttribute("aria-pressed", String(on));
    }
    if (!on && cropRectEl) cropRectEl.hidden = true;
  };

  if (cropBtn) {
    cropBtn.addEventListener("click", () => {
      const next = !cropping;
      if (next && measuring) {
        measuring = false;
        measureBtn?.classList.remove("active");
        measureBtn?.setAttribute("aria-pressed", "false");
        clearMeasure();
        setChip("");
      }
      setCropMode(next);
    });
  }
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      setCropMode(false);
      showCloud(activeIndex);
    });
  }

  const applyCrop = (x0, y0, x1, y1) => {
    if (!activePoints) return;
    const rect = canvas.getBoundingClientRect();
    const geo = activePoints.geometry;
    const pos = geo.getAttribute("position");
    const col = geo.getAttribute("color");
    const v = new THREE.Vector3();
    const keep = new Uint8Array(pos.count);
    let kept = 0;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).project(camera);
      const sx = (v.x * 0.5 + 0.5) * rect.width;
      const sy = (-v.y * 0.5 + 0.5) * rect.height;
      const inside = sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1 && v.z < 1;
      if (!inside) {
        keep[i] = 1;
        kept++;
      }
    }
    if (kept === 0 || kept === pos.count) return; // nothing selected or everything selected
    const np = new Float32Array(kept * 3);
    const nc = new Float32Array(kept * 3);
    let w = 0;
    for (let i = 0; i < pos.count; i++) {
      if (!keep[i]) continue;
      np[w * 3] = pos.getX(i); np[w * 3 + 1] = pos.getY(i); np[w * 3 + 2] = pos.getZ(i);
      nc[w * 3] = col.getX(i); nc[w * 3 + 1] = col.getY(i); nc[w * 3 + 2] = col.getZ(i);
      w++;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(np, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(nc, 3));
    geo.computeBoundingSphere();
    if (resetBtn) resetBtn.hidden = false;
  };

  canvas.addEventListener("pointerdown", (e) => {
    if (!cropping) return;
    const vr = viewer.getBoundingClientRect();
    dragStart = { x: e.clientX - vr.left, y: e.clientY - vr.top };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!cropping || !dragStart || !cropRectEl) return;
    const vr = viewer.getBoundingClientRect();
    const cx = e.clientX - vr.left;
    const cy = e.clientY - vr.top;
    const x = Math.min(dragStart.x, cx), y = Math.min(dragStart.y, cy);
    const w = Math.abs(cx - dragStart.x), h = Math.abs(cy - dragStart.y);
    Object.assign(cropRectEl.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
    cropRectEl.hidden = false;
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!cropping || !dragStart) return;
    const vr = viewer.getBoundingClientRect();
    const cx = e.clientX - vr.left;
    const cy = e.clientY - vr.top;
    const x0 = Math.min(dragStart.x, cx), x1 = Math.max(dragStart.x, cx);
    const y0 = Math.min(dragStart.y, cy), y1 = Math.max(dragStart.y, cy);
    dragStart = null;
    if (cropRectEl) cropRectEl.hidden = true;
    if (x1 - x0 > 8 && y1 - y0 > 8) applyCrop(x0, y0, x1, y1);
  });

  const animate = () => {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  animate();
  showCloud(0);
}

function updateContext(cloud) {
  const grid = document.getElementById("pcCtxGrid");
  const tag = document.getElementById("pcCtxTag");
  if (!grid) return;
  if (tag) tag.textContent = cloud.tag || "";
  grid.innerHTML = "";
  for (const src of cloud.thumbs || []) {
    const img = document.createElement("img");
    img.src = src;
    img.loading = "lazy";
    img.alt = "";
    grid.appendChild(img);
  }
}

async function loadGeometry(cloud) {
  if (loadGeometry.cache?.has(cloud.url)) {
    return loadGeometry.cache.get(cloud.url);
  }
  loadGeometry.cache ||= new Map();

  const response = await fetch(cloud.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${cloud.url}`);
  }
  const buffer = await response.arrayBuffer();
  const geometry = parseBinaryPly(buffer);
  loadGeometry.cache.set(cloud.url, geometry);
  return geometry;
}

function parseBinaryPly(buffer) {
  const bytes = new Uint8Array(buffer);
  const headerEnd = findHeaderEnd(bytes);
  const headerText = new TextDecoder("ascii").decode(bytes.slice(0, headerEnd));
  const lines = headerText.split(/\r?\n/);

  if (!lines.includes("format binary_little_endian 1.0")) {
    throw new Error("Only binary_little_endian PLY files are supported");
  }

  const properties = [];
  let vertexCount = 0;
  let inVertex = false;

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === "element") {
      inVertex = parts[1] === "vertex";
      if (inVertex) vertexCount = Number(parts[2]);
      continue;
    }
    if (inVertex && parts[0] === "property") {
      if (parts[1] === "list") {
        throw new Error("PLY vertex list properties are not supported");
      }
      properties.push({ type: parts[1], name: parts[2], offset: 0 });
    }
  }

  let stride = 0;
  for (const property of properties) {
    property.offset = stride;
    stride += TYPE_BYTES[property.type];
  }

  const xProp = properties.find((p) => p.name === "x");
  const yProp = properties.find((p) => p.name === "y");
  const zProp = properties.find((p) => p.name === "z");
  const rProp = properties.find((p) => p.name === "red");
  const gProp = properties.find((p) => p.name === "green");
  const bProp = properties.find((p) => p.name === "blue");

  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const dataView = new DataView(buffer, headerEnd);

  const read = (property, base) =>
    dataView[TYPE_READERS[property.type]](base + property.offset, true);

  for (let i = 0; i < vertexCount; i++) {
    const base = i * stride;
    const p3 = i * 3;
    positions[p3] = read(xProp, base);
    positions[p3 + 1] = read(yProp, base);
    positions[p3 + 2] = read(zProp, base);
    colors[p3] = rProp ? read(rProp, base) / 255 : 1;
    colors[p3 + 1] = gProp ? read(gProp, base) / 255 : 1;
    colors[p3 + 2] = bProp ? read(bProp, base) / 255 : 1;
  }

  const metricScale = normalizePositions(positions);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  geometry.userData.metricScale = metricScale; // meters per normalized unit
  return geometry;
}

function findHeaderEnd(bytes) {
  const marker = new TextEncoder().encode("end_header\n");
  for (let i = 0; i <= bytes.length - marker.length; i++) {
    let found = true;
    for (let j = 0; j < marker.length; j++) {
      if (bytes[i + j] !== marker[j]) {
        found = false;
        break;
      }
    }
    if (found) return i + marker.length;
  }
  throw new Error("PLY header is missing end_header");
}

function normalizePositions(positions) {
  const center = new THREE.Vector3();
  const box = new THREE.Box3();
  const point = new THREE.Vector3();

  for (let i = 0; i < positions.length; i += 3) {
    point.set(positions[i], positions[i + 1], positions[i + 2]);
    box.expandByPoint(point);
  }

  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 1 / maxDim;

  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i] - center.x) * scale;
    positions[i + 1] = -(positions[i + 1] - center.y) * scale;
    positions[i + 2] = (positions[i + 2] - center.z) * scale;
  }
  return maxDim; // original extent in meters: converts normalized distances back to metric
}

function frameGeometry(geometry, camera, controls) {
  geometry.computeBoundingSphere();
  const radius = geometry.boundingSphere?.radius || 0.8;
  camera.position.set(0, radius * 0.2, radius * 2.24);
  camera.near = Math.max(radius / 100, 0.001);
  camera.far = radius * 20;
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, 0);
  controls.update();
}

function setStatus(message) {
  statusEl.textContent = message;
  statusEl.classList.toggle("hidden", !message);
}
