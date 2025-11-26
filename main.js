import * as THREE from 'three';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.181.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.150.1/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.150.1/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'https://cdn.jsdelivr.net/npm/three@0.150.1/examples/jsm/postprocessing/BokehPass.js';
import GUI from 'lil-gui';

const noise = new Noise(Math.random());

// ✨ MODIFICACIÓN 1: Aumenté el número de nodos de 100 a 150 para mayor densidad visual
const N = 150;

const params = {
  minCuradores: N * 0.05,
  maxCuradores: N * 0.15,
  maxCuradoresLimit: N * 0.5,
  propagationInterval: 1500,      // ✨ MODIFICACIÓN 2: Reduje de 2000 a 1500 (propagación más rápida)
  propagationProbability: 0.35,    // ✨ MODIFICACIÓN 3: Aumenté de 0.2 a 0.35 (más contagioso)
  cureProbability: 0.8,       // ✨ MODIFICACIÓN 4: Reduje de 1 a 0.8 (curadores menos efectivos)
  curadorConversionProbability: 0.3,  // ✨ MODIFICACIÓN 5: Aumenté de 0.2 a 0.3 (más curadores se crean)
  curadorCooldown: 5,
  infectedRepulsion: 0.5,
  attractionForce: 2, 
  maxForceIncrement: 0.05,
  frictionBase: 0.55,
  frictionHigh: 0.45,
  maxGraphRadius: 10,
  maxCenteringForce: 0.05,
  // ✨ MODIFICACIÓN 6: Agregué nuevo parámetro para controlar velocidad de pulsación
  pulseSpeed: 8
};

const gui = new GUI();
gui.add(params, 'minCuradores', 1, N * 0.5).step(N * 0.05).name('Min Curadores');
gui.add(params, 'maxCuradores', N * 0.1, N * 0.9).step(N * 0.05).name('Max Curadores').listen();
gui.add(params, 'maxCuradoresLimit', 1, N * 0.9).step(N * 0.05).name('Max Curadores Limit');
gui.add(params, 'propagationInterval', 100, 2000).step(100).name('Intervalo Propagación');
gui.add(params, 'propagationProbability', 0.01, 1).step(0.01).name('Probabilidad Contagio');
gui.add(params, 'cureProbability', 0.01, 1).step(0.01).name('Probabilidad Cura');
gui.add(params, 'curadorConversionProbability', 0, 1).step(0.01).name('Probabilidad Conversión');
gui.add(params, 'curadorCooldown', 0, 10).step(0.1).name('Curador cool down');
gui.add(params, 'maxForceIncrement', 0.01, 0.1).step(0.01).name('Incremento Máx. Fuerza');
gui.add(params, 'infectedRepulsion', 0.01, 2).step(0.01).name('Fuerza de repulsión');
gui.add(params, 'attractionForce', 0.01, 2).step(0.01).name('Fuerza de atracción');
gui.add(params, 'frictionBase', 0.1, 1).step(0.05).name('Fricción Base');
gui.add(params, 'frictionHigh', 0.1, 1).step(0.05).name('Fricción Alta');
gui.add(params, 'maxGraphRadius', 1, 100).step(1).name('Radio del grafo');
gui.add(params, 'maxCenteringForce', 0.01, 2).step(0.05).name('Fuerza Centrípeta');
// ✨ MODIFICACIÓN 7: Agregué control de velocidad de pulsación al GUI
gui.add(params, 'pulseSpeed', 1, 20).step(1).name('Velocidad Pulsación');

const nodes = [];
const edges = [];

let lastPropagationTime = 0;
let lastLinkUpdateTime = 0;
let curadores = [];

const curadoresChangeInterval = 5000;
let lastChangeTime = 0;

const infectionInterval = 8000; // ✨ MODIFICACIÓN 8: Reduje de 10000 a 8000 (infección aleatoria más frecuente)
let lastInfectionTime = 0;

let time = 0;
const radiusMin = 5;
const radiusMax = 30;
const rotationSpeed = 0.15;    // ✨ MODIFICACIÓN 9: Aumenté de 0.1 a 0.15 (cámara rota más rápido)
const zoomSpeed = 0.1;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer({
  precision: 'mediump',
  antialias: true  // ✨ MODIFICACIÓN 10: Agregué antialiasing para mejor calidad visual
});
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bokehPass = new BokehPass(scene, camera, {
  focus: 0.5,
  aperture: 0.035,      // ✨ MODIFICACIÓN 11: Aumenté de 0.025 a 0.035 (más desenfoque)
  maxblur: 0.22,        // ✨ MODIFICACIÓN 12: Aumenté de 0.18 a 0.22 (blur más pronunciado)
  width: window.innerWidth,
  height: window.innerHeight
});
composer.addPass(bokehPass);

const controls = new OrbitControls(camera, renderer.domElement);

for (let i = 1; i <= N; i++) {
  nodes.push({
    id: i,
    position: new THREE.Vector3(
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20
    ),
    infected: false,
    velocity: new THREE.Vector3()
  });
}

for (let i = 0; i < N; i++) {
  const numConexiones = Math.floor(Math.random() * N *.01) + 2;
  for (let j = 0; j < numConexiones; j++) {
    const targetIndex = Math.floor(Math.random() * N);
    if (
      targetIndex !== i &&
      !edges.some(e => (e.source === nodes[i].id && e.target === nodes[targetIndex].id) ||
              (e.source === nodes[targetIndex].id && e.target === nodes[i].id))
    ) {
      edges.push({ source: nodes[i].id, target: nodes[targetIndex].id });
    }
  }
}

// ✨ MODIFICACIÓN 13: Aumenté detalle de esferas de (8,8) a (12,12)
const sphereGeometry = new THREE.SphereGeometry(0.3, 12, 12);

nodes.forEach(node => {
  const colorStr = getRandomNodeColor();
  const color = new THREE.Color(colorStr);
  node.baseColor = color.clone();
  const material = new THREE.MeshBasicMaterial({ color: color });
  node.mesh = new THREE.Mesh(sphereGeometry, material);
  node.mesh.position.copy(node.position);
  scene.add(node.mesh);
});
  
edges.forEach(edge => {
  const material = new THREE.LineBasicMaterial({ color: getEdgeColor() });
  const points = [new THREE.Vector3(), new THREE.Vector3()];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geometry, material);
  edge.line = line;
  scene.add(line);
});

camera.position.z = 10;

infectNode(nodes[0]);
curadores.push(nodes[N-1]);

// ✨ MODIFICACIÓN 14: Aumenté partículas de 200 a 300 para fondo más denso
const particleCount = 300;
const positions = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount; i++) {
  positions[i * 3]     = (Math.random() - 0.5) * 30;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
}

const particlesGeometry = new THREE.BufferGeometry();
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const loader = new THREE.TextureLoader();
const particleTexture = loader.load('bacteria.png');

const particlesMaterial = new THREE.PointsMaterial({
  size: 0.4,  // ✨ MODIFICACIÓN 15: Aumenté tamaño de partículas de 0.3 a 0.4
  map: particleTexture,
  transparent: true,
  opacity: 0.15,  // ✨ MODIFICACIÓN 16: Aumenté opacidad de 0.1 a 0.15 (más visibles)
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  color: 0xffffff
});

const particleSystem = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particleSystem);

const basePositions = positions.slice();

// ✨ MODIFICACIÓN 17: Agregué contador de estadísticas en pantalla
const statsDiv = document.createElement('div');
statsDiv.style.position = 'absolute';
statsDiv.style.top = '10px';
statsDiv.style.left = '10px';
statsDiv.style.color = 'white';
statsDiv.style.fontFamily = 'monospace';
statsDiv.style.fontSize = '14px';
statsDiv.style.background = 'rgba(0,0,0,0.7)';
statsDiv.style.padding = '10px';
statsDiv.style.borderRadius = '5px';
document.body.appendChild(statsDiv);

function animate(time) {
  const elapsedTime = time * 0.0001;
  requestAnimationFrame(animate);

  applyForces();

  curadores.forEach(node => {
    if (node.curadorActiveCycles > 0) node.curadorActiveCycles--;
  });

  curadores = curadores.filter(node => node.curadorActiveCycles > 0);
  maintainMinCuradores();

  if (time - lastPropagationTime > params.propagationInterval) {
    propagateDisinformation();
    propagateCure();
    lastPropagationTime = time;
  }
  
  if (time - lastInfectionTime > infectionInterval) {
    infectRandomNode();
    lastInfectionTime = time;
  }
  
  updateMaxCuradores(time);
  updateEdgeColors();
  applyOrganicMovement();
  animateParticles(time);

  // ✨ MODIFICACIÓN 18: Actualizo estadísticas en tiempo real
  updateStats();

  nodes.forEach(node => {
    node.mesh.position.copy(node.position);
  });
  
  nodes.forEach((node, index) => {
    // ✨ MODIFICACIÓN 19: Uso el parámetro pulseSpeed del GUI para controlar velocidad
    const frequency = params.pulseSpeed;
    const amplitude = 0.25;  // ✨ MODIFICACIÓN 20: Aumenté amplitud de 0.2 a 0.25
    const baseScale = 1;
    let scale = 1;

    const phase = (index / nodes.length) * Math.PI * 2;
    
    if(node.infected == true){
      scale = baseScale + amplitude * Math.sin(2 * Math.PI * frequency * elapsedTime + phase);
    } else {
      scale = baseScale + amplitude * Math.sin(2 * Math.PI * frequency/4.0 * elapsedTime + phase);
    }
    
    node.mesh.scale.set(scale, scale, scale);
    node.mesh.position.copy(node.position);
  });
  
  if (time - lastLinkUpdateTime > 3000) {
    updateLinks();
    lastLinkUpdateTime = time;
  }

  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    const positions = edge.line.geometry.attributes.position.array;

    positions[0] = sourceNode.position.x;
    positions[1] = sourceNode.position.y;
    positions[2] = sourceNode.position.z;

    positions[3] = targetNode.position.x;
    positions[4] = targetNode.position.y;
    positions[5] = targetNode.position.z;

    edge.line.geometry.attributes.position.needsUpdate = true;
  });

  const radius = radiusMin + (radiusMax - radiusMin) * (0.5 + 0.5 * Math.sin(elapsedTime * zoomSpeed));
  const angle = elapsedTime * rotationSpeed;
  const cameraY = 10;

  const x = radius * Math.cos(angle);
  const z = radius * Math.sin(angle);

  controls.object.position.set(x, cameraY, z);
  camera.lookAt(controls.target);

  controls.update();
  composer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ✨ MODIFICACIÓN 21: Nueva función para actualizar estadísticas en pantalla
function updateStats() {
  const infected = nodes.filter(n => n.infected).length;
  const healthy = nodes.filter(n => !n.infected && !curadores.includes(n)).length;
  const curadoresCount = curadores.length;
  
  statsDiv.innerHTML = `
    <strong>📊 ESTADÍSTICAS DE RED</strong><br>
    Total Nodos: ${N}<br>
    🔴 Infectados: ${infected} (${((infected/N)*100).toFixed(1)}%)<br>
    🟢 Sanos: ${healthy} (${((healthy/N)*100).toFixed(1)}%)<br>
    🔵 Curadores: ${curadoresCount} (${((curadoresCount/N)*100).toFixed(1)}%)<br>
    🔗 Conexiones: ${edges.length}
  `;
}

function applyForces() {
  const baseRepulsion = 0.01;
  const infectedRepulsion = params.infectedRepulsion;
  const attractionForce = params.attractionForce;
  const maxForce = 2;
  const maxForceIncrement = params.maxForceIncrement;
  const minDistance = 5;
  const frictionBase = params.frictionBase;
  const frictionHigh = params.frictionHigh;
  const maxRadius = params.maxGraphRadius || 50;
  const maxCenteringForce = params.maxCenteringForce || 0.05;

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      let nodeA = nodes[i];
      let nodeB = nodes[j];
      let dir = new THREE.Vector3().subVectors(nodeA.position, nodeB.position);
      let dist = dir.length();
      if (dist > 0) {
        let repulsionA = nodeA.infected ? infectedRepulsion : baseRepulsion;
        let repulsionB = nodeB.infected ? infectedRepulsion : baseRepulsion;
        let repulsion = (repulsionA + repulsionB) / 2;

        let forceMag = 0;
        if (dist < minDistance) {
          forceMag = repulsion * (minDistance - dist);
        } else {
          forceMag = repulsion / (dist * dist);
        }
        forceMag = Math.min(forceMag, maxForce);

        dir.normalize();

        let incrementA = dir.clone().multiplyScalar(forceMag);
        if (incrementA.length() > maxForceIncrement) {
          incrementA.setLength(maxForceIncrement);
        }
        let incrementB = dir.clone().multiplyScalar(-forceMag);
        if (incrementB.length() > maxForceIncrement) {
          incrementB.setLength(maxForceIncrement);
        }

        nodeA.velocity.add(incrementA);
        nodeB.velocity.add(incrementB);
      }
    }
  }

  edges.forEach(edge => {
    let sourceNode = nodes.find(n => n.id === edge.source);
    let targetNode = nodes.find(n => n.id === edge.target);
    let dir = new THREE.Vector3().subVectors(targetNode.position, sourceNode.position);
    let dist = dir.length();
    let forceMag = attractionForce * (dist * dist);
    forceMag = Math.min(forceMag, maxForce);
    dir.normalize();

    let incrementS = dir.clone().multiplyScalar(forceMag);
    if (incrementS.length() > maxForceIncrement) incrementS.setLength(maxForceIncrement);
    let incrementT = dir.clone().multiplyScalar(-forceMag);
    if (incrementT.length() > maxForceIncrement) incrementT.setLength(maxForceIncrement);

    sourceNode.velocity.add(incrementS);
    targetNode.velocity.add(incrementT);
  });

  nodes.forEach(node => {
    const toCenter = node.position.clone().negate();
    const distToCenter = node.position.length();

    if (distToCenter > maxRadius) {
      let excess = distToCenter - maxRadius;
      let centeringForceMag = Math.min(excess * 0.1, maxCenteringForce);
      toCenter.normalize().multiplyScalar(centeringForceMag);
      node.velocity.add(toCenter);
    }

    const vLength = node.velocity.length();
    if (vLength > 0.1) {
      node.velocity.multiplyScalar(frictionHigh);
    } else {
      node.velocity.multiplyScalar(frictionBase);
    }

    const newPos = node.position.clone().add(node.velocity);
    node.position.lerp(newPos, 0.5);
  });
}

function propagateDisinformation() {
  let newInfections = [];

  nodes.forEach(node => {
    if (node.infected) {
      edges.forEach(edge => {
        let neighborId = null;
        if (edge.source === node.id) neighborId = edge.target;
        else if (edge.target === node.id) neighborId = edge.source;

        if (neighborId !== null) {
          let neighbor = nodes.find(n => n.id === neighborId);

          if (!neighbor.infected && !curadores.includes(neighbor) && Math.random() < params.propagationProbability) {
            newInfections.push(neighbor);
          }
        }
      });
    }
  });

  newInfections.forEach(node => {
    node.infected = true;
    node.mesh.material.color.set(0xaa8888);
  });
}

function propagateCure() {
  let newCures = [];
  let newCuradores = [];

  curadores.forEach(curador => {
    edges.forEach(edge => {
      if (edge.source === curador.id || edge.target === curador.id) {
        let neighborId = (edge.source === curador.id) ? edge.target : edge.source;
        let neighbor = nodes.find(n => n.id === neighborId);
        if (neighbor.infected && Math.random() < params.cureProbability) {
          if (!newCures.includes(neighbor)) {
            newCures.push(neighbor);

            if (Math.random() < (params.curadorConversionProbability || 0.1)) {
              neighbor.curadorActiveCycles = params.curadorCooldown || 5;
              if (!curadores.includes(neighbor)) newCuradores.push(neighbor);
            }
          }
        }
      }
    });
  });

  newCures.forEach(node => {
    node.infected = false;
    node.mesh.material.color.copy(node.baseColor);
  });

  if (curadores.length < params.maxCuradores) {
    const spaceLeft = params.maxCuradores - curadores.length;
    curadores = curadores.concat(newCuradores.slice(0, spaceLeft));
  }
}

curadores.forEach(node => {
  if (node.curadorActiveCycles > 0) node.curadorActiveCycles--;
});

function maintainMinCuradores() {
  while (curadores.length < params.minCuradores) {
    const candidates = nodes.filter(n => !n.infected && !curadores.includes(n));
    if (candidates.length === 0) break;

    const candidate = candidates[Math.floor(Math.random() * candidates.length)];
    candidate.curadorActiveCycles = params.curadorCooldown || 5;
    curadores.push(candidate);

    candidate.mesh.material.color.set(0x0077ff);
  }
}

function infectNode(node) {
  if (node.mesh && node.mesh.material) {
    node.mesh.material.color.set(0x664444);
    node.infected = true;
  }
}

function infectRandomNode() {
  const candidates = nodes.filter(node => !node.infected && !curadores.includes(node));
  if (candidates.length === 0) return;

  const randomIndex = Math.floor(Math.random() * candidates.length);
  const node = candidates[randomIndex];

  node.infected = true;
  node.mesh.material.color.set(0x886666);
}

function updateLinks() {
  const removalProbability = 0.1;
  const creationProbability = 0.05;
  const maxDistanceNewLink = 5;

  const maxTotalEdges = Math.floor(N * 3);

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const hasEdge = new Set(edges.map(e => `${Math.min(e.source, e.target)}_${Math.max(e.source, e.target)}`));

  const edgesToRemove = [];

  for (let i = edges.length -1; i >= 0; i--) {
    const edge = edges[i];
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);

    if ((sourceNode.infected !== targetNode.infected) && Math.random() < removalProbability) {
      edgesToRemove.push(i);
    }
  }

  for (let k = edgesToRemove.length - 1; k >= 0; k--) {
    const idx = edgesToRemove[k];
    const edge = edges[idx];
    scene.remove(edge.line);
    hasEdge.delete(`${Math.min(edge.source, edge.target)}_${Math.max(edge.source, edge.target)}`);
    edges.splice(idx, 1);
  }

  const maxNewEdgesPerCycle = 50; 
  let newEdgesCreated = 0;

  for (let i = 0; i < nodes.length && newEdgesCreated < maxNewEdgesPerCycle && edges.length < maxTotalEdges; i++) {
    const nodeA = nodes[i];
    if (nodeA.infected) continue;

    for (let j = i + 1; j < nodes.length && newEdgesCreated < maxNewEdgesPerCycle && edges.length < maxTotalEdges; j++) {
      const nodeB = nodes[j];
      if (nodeB.infected) continue;

      const key = `${Math.min(nodeA.id, nodeB.id)}_${Math.max(nodeA.id, nodeB.id)}`;
      if (hasEdge.has(key)) continue;

      const dist = nodeA.position.distanceTo(nodeB.position);

      if (dist < maxDistanceNewLink && Math.random() < creationProbability) {
        const material = new THREE.LineBasicMaterial({ color: getEdgeColor() });
        const points = [nodeA.position.clone(), nodeB.position.clone()];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, material);
        scene.add(line);

        edges.push({ source: nodeA.id, target: nodeB.id, line });
        hasEdge.add(key);

        newEdgesCreated++;
      }
    }
  }
}

function getRandomNodeColor() {
  const hue = 180 + Math.random() * 30;
  const saturation = 30 + Math.random() * 20;
  const lightness = 70 + Math.random() * 20;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function getEdgeColor() {
  const baseHue = 210;
  const saturation = 10 + Math.random() * 20;
  const lightness = 60 + Math.random() * 15;
  return new THREE.Color(`hsl(${baseHue}, ${saturation}%, ${lightness}%)`);
}

function updateEdgeColors() {
  edges.forEach(edge => {
    let sourceNode = nodes.find(n => n.id === edge.source);
    let targetNode = nodes.find(n => n.id === edge.target);

    const colorSource = sourceNode.mesh.material.color.clone();
    const colorTarget = targetNode.mesh.material.color.clone();

    const mixedColor = colorSource.lerp(colorTarget, 0.5);

    edge.line.material.color.copy(mixedColor);
  });
}

function updateMaxCuradores(time) {
  if (time - lastChangeTime > curadoresChangeInterval) {
    const maxStep = 10;

    let nextMax = params.maxCuradores + (Math.floor(Math.random() * (2 * maxStep + 1)) - maxStep);

    if (nextMax < params.minCuradores) nextMax = params.minCuradores;
    if (nextMax > params.maxCuradoresLimit) nextMax = params.maxCuradoresLimit;

    params.maxCuradores = nextMax;
  
    console.log('Nuevo maxCuradores:', params.maxCuradores);
    lastChangeTime = time;
  }
}

function applyOrganicMovement() {
  nodes.forEach((node, i) => {
    let time = performance.now() * 0.001;
    let nx = noise.perlin3(node.position.x * 0.1, node.position.y * 0.1, time);
    let ny = noise.perlin3(node.position.y * 0.1, node.position.z * 0.1, time);
    let nz = noise.perlin3(node.position.z * 0.1, node.position.x * 0.1, time);

    let organicForce = new THREE.Vector3(nx, ny, nz).multiplyScalar(0.3);

    node.velocity.add(organicForce);
  });
}

function createRadialGradientTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  const gradient = ctx.createRadialGradient(size/2, size/5, size/20, size/2, size/2, size/2);
  gradient.addColorStop(1, '#000000');
  gradient.addColorStop(0, '#222222');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  return new THREE.CanvasTexture(canvas);
}

scene.background = createRadialGradientTexture();

function animateParticles(time) {
  const elapsed = time * 0.001;
  const positions = particleSystem.geometry.attributes.position.array;

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3 + 1] = basePositions[i * 3 + 1] + Math.sin(elapsed + i) * 0.1;
    positions[i * 3] = basePositions[i * 3] + Math.cos(elapsed + i * 1.1) * 0.05;
    positions[i * 3 + 2] = basePositions[i * 3 + 2] + Math.sin(elapsed + i * 1.3) * 0.05;
  }
  particleSystem.geometry.attributes.position.needsUpdate = true;
}
