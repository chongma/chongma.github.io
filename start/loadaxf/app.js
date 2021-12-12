import * as THREE from '../../libs/three/three.module.js';
import { VRButton } from './VRButton.js';
import { XRControllerModelFactory } from '../../libs/three/jsm/XRControllerModelFactory.js';
import { Stats } from '../../libs/stats.module.js';
import { OrbitControls } from '../../libs/three/jsm/OrbitControls.js';

import { BoxLineGeometry } from '../../libs/three/jsm/BoxLineGeometry.js';

const PARTICLE_SIZE = 0.02
const factor = 1 / 10000
const factor2 = 1 / 1000

let clock
let camera
let scene
let renderer
let controls
let stats
let raycaster
const threshold = 0.01;

let workingMatrix
let workingVector
let origin

let radius
let room
let marker
// let group
let controller
let controllerGrip
let controllerLine
let particles

let axf
let obj

let INTERSECTED

window.addEventListener('DOMContentLoaded', () => {
    initialise()
})

function initialise() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.6, 3);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x505050);

    scene.add(new THREE.HemisphereLight(0x606060, 0x404040));

    const light = new THREE.DirectionalLight(0xffffff);
    light.position.set(1, 1, 1).normalize();
    scene.add(light);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;

    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.6, 0);
    controls.update();

    stats = new Stats();

    initScene();
    setupXR();

    window.addEventListener('resize', resize);

    raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = threshold;

    workingMatrix = new THREE.Matrix4();
    origin = new THREE.Vector3();

    renderer.setAnimationLoop(render);
}

function random(min, max) {
    return Math.random() * (max - min) + min;
}

function initScene() {
    radius = 0.08;

    room = new THREE.LineSegments(
        new BoxLineGeometry(6, 6, 6, 10, 10, 10),
        new THREE.LineBasicMaterial({ color: 0x808080 })
    );
    room.geometry.translate(0, 3, 0);
    scene.add(room);

    loadMarker()

    // loadBalls()

    loadAxf()
    // loadObj()
    setTimeout(function () {
        renderAxf()
        renderObj()
    }, 1000)

}

function loadMarker() {
    const geometry = new THREE.SphereBufferGeometry(0.05, 8, 8);
    const material = new THREE.MeshStandardMaterial({ color: 0xaa0000 });
    marker = new THREE.Mesh(geometry, material);
    marker.visible = false;
    scene.add(marker);
}

function loadBalls() {
    const geometry = new THREE.IcosahedronBufferGeometry(radius, 2);
    for (let i = 0; i < 200; i++) {
        const object = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff }));
        object.position.x = random(-2, 2);
        object.position.y = random(0, 4);
        object.position.z = random(-2, 2);
        room.add(object);
    }
}

function geometryLayer(spline, layerY) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(spline.nodes.length * 3);
    spline.nodes.forEach((node, index) => {
        const offset = index * 3
        positions[offset] = node.point.x * factor;
        positions[offset + 1] = (layerY * factor) + 1;
        positions[offset + 2] = (node.point.y * factor) - 1;
    });
    // console.log(positions);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingBox();
    // geometry.scale(factor, factor, factor);
    return geometry;
}

function geometryFrontSilhouette(spline) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(spline.nodes.length * 3);
    spline.nodes.forEach((node, index) => {
        const offset = index * 3
        positions[offset] = node.point.x * factor;
        positions[offset + 1] = (node.point.y * factor) + 1;
        positions[offset + 2] = 0 - 1;
    });
    // console.log(positions);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingBox();
    // geometry.scale(factor, factor, factor);
    return geometry;
}

function geometrySideSilhouette(spline) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(spline.nodes.length * 3);
    spline.nodes.forEach((node, index) => {
        const offset = index * 3
        positions[offset] = 0;
        positions[offset + 1] = (node.point.y * factor) + 1;
        positions[offset + 2] = (node.point.x * factor) - 1;
    });
    // console.log(positions);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.computeBoundingBox();
    // geometry.scale(factor, factor, factor);
    return geometry;
}

// function renderSpline(spline, linewidth) {
//   const material = new THREE.LineBasicMaterial({
//     linewidth,
//     vertexColors: THREE.VertexColors
//   });
//   const line = new THREE.Line(spline, material);
//   group.add(line);
// }

function renderSplineColour(spline, linewidth, colour) {
    const material = new THREE.LineBasicMaterial({
        linewidth,
        color: colour
    });
    const line = new THREE.Line(spline, material);
    room.add(line);
}

function randomColour() {
    return Math.random() * 0xffffff;
}

function loadAxf() {
    var oReq = new XMLHttpRequest();
    oReq.open("GET", "/assets/test.axf", true);
    oReq.responseType = "arraybuffer";

    oReq.onload = function (oEvent) {
        var arrayBuffer = oReq.response; // Note: not oReq.responseText
        // console.log(arrayBuffer)
        var b = buffer.Buffer.from(arrayBuffer)
        axf = AxfBean.readAxf(b)
    };
    oReq.send(null);
}

function renderAxf() {
    // room.remove(group);
    // group = new THREE.Group();
    // room.add(group);
    // renderer.setAnimationLoop(animate);
    // console.log(axf)
    if (axf) {
        const fcolour = randomColour();
        const scolour = randomColour();
        axf.bodyParts.forEach((bodypart) => {
            const colour = randomColour();
            bodypart.layers.forEach((layer) =>
                renderSplineColour(geometryLayer(layer.splineLayer.surface, layer.y), 1.5, colour)
            );
            if (bodypart.frontSilhouette) {
                bodypart.frontSilhouette.forEach((sil) => {
                    renderSplineColour(geometryFrontSilhouette(sil.spline), 4, fcolour);
                });
            }
            if (bodypart.sideSilhouette) {
                bodypart.sideSilhouette.forEach((sil) => {
                    renderSplineColour(geometrySideSilhouette(sil.spline), 4, scolour);
                });
            }
        });
    }
    // group.position.x = 1
    // group.position.y = 1
    // group.position.z = -1
}

function loadObj() {
    var oReq = new XMLHttpRequest();
    oReq.open("GET", "/assets/test.obj", true);
    oReq.responseType = "arraybuffer";

    oReq.onload = function (oEvent) {
        var arrayBuffer = oReq.response; // Note: not oReq.responseText
        // console.log(arrayBuffer)
        var b = buffer.Buffer.from(arrayBuffer)
        var lines = b.toString().split(/(?:\r\n|\r|\n)/g);
        let vertices = []
        lines.forEach(line => {
            if (line.startsWith('v ')) {
                let parts = line.split(' ')
                let vertex = [parts[1], parts[2], parts[3]]
                vertices.push(vertex)
            }
        })
        obj = vertices
    };
    oReq.send(null);
}

function renderObj() {
    // scene.remove(group2);
    // group2 = new THREE.Group();
    // room.add(group2);
    // renderer.setAnimationLoop(animate);
    // console.log(obj)
    if (obj) {
        // const colour = randomColour();
        // renderPointCloudColour(geometryPoints2())
        // loadGeometryBalls()
        geometryPoints()
    }
    // group2.position.x = -1
    // group2.position.y = 0
    // group2.position.z = -1
}

function loadGeometryBalls() {
    const geometry = new THREE.IcosahedronBufferGeometry(radius, 2);
    obj.forEach((node, index) => {
        const object = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff }));
        object.position.x = (node[0] / 1000) - 1;
        object.position.y = node[1] / 1000;
        object.position.z = (node[2] / 1000) - 1;
        room.add(object);
    });
}

function geometryPoints() {
    const positions = [];
    obj.forEach((node, index) => {
        const x = node[0];
        const y = node[1];
        const z = node[2];
        positions.push(x, y, z);
    });
    // console.log(positions);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeBoundingBox()
    const material = new THREE.PointsMaterial({ color: randomColour(), size: PARTICLE_SIZE });
    particles = new THREE.Points(geometry, material);
    particles.scale.set(factor2, factor2, factor2)
    particles.position.set(-1, 0, -1)
    room.add(particles);
}

function geometryPoints2() {
    const positions = [];
    const sizes = [];
    const colors = [];
    obj.forEach((node, index) => {
        const x = (node[0] / 1000) - 1;
        const y = node[1] / 1000;
        const z = (node[2] / 1000) - 1;
        positions.push(x, y, z);
        sizes.push(PARTICLE_SIZE)
        const colour = new THREE.Color(randomColour())
        // const colour = new THREE.Color(0xbbbbbb)
        colour.toArray(colors, index * 3);
    });
    // console.log(positions);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('customColor', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    // geometry.computeBoundingSphere();
    // geometry.scale(factor2, factor2, factor2);
    return geometry;
}

function renderPointCloudColour(geometry) {
    // room.remove(particles)
    // const material = new THREE.PointsMaterial();
    const material = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(0xffffff) },
            pointTexture: { value: new THREE.TextureLoader().load("../../assets/disc.png") }
        },
        vertexShader: document.getElementById('vertexshader').textContent,
        fragmentShader: document.getElementById('fragmentshader').textContent,

        blending: THREE.AdditiveBlending,
        depthTest: false,
        transparent: true

    });
    particles = new THREE.Points(geometry, material);
    room.add(particles);
}

// function addConstraint(pos, body) {
//     const pivot = pos.clone()
//     body.threemesh.worldToLocal(pivot)
//     jointBody.position.copy(pos)

//     const constraint = new CANNON.PointToPointConstraint(body, pivot, jointBody, new CANNON.Vec3(0, 0, 0))

//     world.addConstraint(constraint)

//     controller.userData.constraint = constraint
// }

function setupXR() {
    renderer.xr.enabled = true;
    const button = new VRButton(renderer);

    // function onSelectStart() {
    //     userData.selectPressed = true;
    //     if (userData.selected) {
    //         addConstraint(marker.getWorldPosition(origin), particles);
    //         controller.attach(marker);
    //     }
    // }

    // function onSelectEnd() {
    //     userData.selectPressed = false;
    //     const constraint = controller.userData.constraint;
    //     if (constraint) {
    //         world.removeConstraint(constraint);
    //         controller.userData.constraint = undefined;
    //         scene.add(marker);
    //         marker.visible = false;
    //     }
    // }

    controller = renderer.xr.getController(0);
    // controller.addEventListener('selectstart', onSelectStart);
    // controller.addEventListener('selectend', onSelectEnd);
    controller.addEventListener('connected', function (event) {
        controllerLine = buildController(event.data);
        controllerLine.scale.z = 0;
        controller.add(controllerLine);

    });
    controller.addEventListener('disconnected', function () {
        remove(children[0]);
        controller = null;
        controllerGrip = null;

    });
    scene.add(controller);

    const controllerModelFactory = new XRControllerModelFactory();

    controllerGrip = renderer.xr.getControllerGrip(0);
    controllerGrip.add(controllerModelFactory.createControllerModel(controllerGrip));
    scene.add(controllerGrip);
}

function buildController(data) {
    let geometry, material;
    // switch (data.targetRayMode) {
    //     case 'tracked-pointer':
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, - 1], 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3));
    material = new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending });
    return new THREE.Line(geometry, material);
    // case 'gaze':
    //     geometry = new THREE.RingBufferGeometry(0.02, 0.04, 32).translate(0, 0, - 1);
    //     material = new THREE.MeshBasicMaterial({ opacity: 0.5, transparent: true });
    //     return new THREE.Mesh(geometry, material);
    // }
}

function handleController(controller) {
    // if (!controller.userData.selectPressed) {
    controller.children[0].scale.z = 10

    workingMatrix.identity().extractRotation(controller.matrixWorld)
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld)
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(workingMatrix)

    const intersects = raycaster.intersectObjects(room.children, false)

    // const geometry = particles.geometry;
    // const attributes = geometry.attributes;

    if (intersects.length > 0) {
        // if (INTERSECTED && INTERSECTED != intersects[0].index) {
        //     attributes.size.array[INTERSECTED] = PARTICLE_SIZE;
        // }
        // INTERSECTED = intersects[0].index;
        // attributes.size.array[INTERSECTED] = PARTICLE_SIZE * 1.5;
        // attributes.size.needsUpdate = true;
        // intersects[0].object.material.color.set(0xff0000);
        marker.position.copy(intersects[0].point);
        // const offset = intersects[0].index * 3
        // marker.position.x = attributes.position.array[offset]
        // marker.position.y = attributes.position.array[offset + 1]
        // marker.position.z = attributes.position.array[offset + 2]
        // marker.scale.set(factor2, factor2, factor2)
        // console.log(intersects[0].index)
        marker.visible = true;
        // controller.children[0].scale.z = intersects[0].distance;
        // controller.userData.selected = true;
    } else {
        marker.visible = false;
        // controller.userData.selected = false;
        // if (INTERSECTED) {
        //     attributes.size.array[INTERSECTED] = PARTICLE_SIZE;
        //     attributes.size.needsUpdate = true;
        //     INTERSECTED = null;
        // }
    }
    // } else {
    //     const constraint = controller.userData.constraint;
    //     if (constraint) {
    //         jointBody.position.copy(marker.getWorldPosition(origin));
    //         constraint.update();
    //     }
    // }
}

function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function render() {
    stats.update();
    if (renderer.xr.isPresenting) handleController(controller);
    renderer.render(scene, camera);
}