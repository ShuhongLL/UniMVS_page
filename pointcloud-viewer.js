import * as THREE from "./assets/vendor/three.module.js";
import { OrbitControls } from "./assets/vendor/OrbitControls.js";

const CLOUDS = [
  {
    name: "Point Cloud 1",
    url: "assets/pointclouds/1780394583405367087.ply",
  },
  {
    name: "Point Cloud 2",
    url: "assets/pointclouds/1780395677253282878.ply",
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
    setStatus("Loading point cloud...");

    try {
      const geometry = await loadGeometry(cloud);
      if (activePoints) {
        scene.remove(activePoints);
      }

      const material = new THREE.PointsMaterial({
        size: 0.006,
        vertexColors: true,
        sizeAttenuation: true,
      });

      activePoints = new THREE.Points(geometry, material);
      scene.add(activePoints);
      frameGeometry(geometry, camera, controls);
      setStatus("");
    } catch (error) {
      console.error(error);
      setStatus("Point cloud failed to load");
    }
  };

  prevBtn.addEventListener("click", () => showCloud(activeIndex - 1));
  nextBtn.addEventListener("click", () => showCloud(activeIndex + 1));

  const animate = () => {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };

  animate();
  showCloud(0);
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

  normalizePositions(positions);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
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
  const scale = 1 / Math.max(size.x, size.y, size.z);

  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (positions[i] - center.x) * scale;
    positions[i + 1] = -(positions[i + 1] - center.y) * scale;
    positions[i + 2] = (positions[i + 2] - center.z) * scale;
  }
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
