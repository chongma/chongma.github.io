import * as THREE from '../../libs/three/three.module.js';

import { RGBELoader } from '../../libs/three/jsm/RGBELoader.js';
import { Stats } from '../../libs/stats.module.js';
import { XRControllerModelFactory } from '../../libs/three/jsm/XRControllerModelFactory.js';
import { VRButton } from './VRButton.js';

import { fetchProfile } from '../../libs/three/jsm/motion-controllers.module.js';

const DEFAULT_PROFILES_PATH = 'https://cdn.jsdelivr.net/npm/@webxr-input-profiles/assets@1.0/dist/profiles';
const DEFAULT_PROFILE = 'generic-trigger';

let renderer, scene, camera, stats
let pointclouds = []
let raycaster
let intersection = null
let spheresIndex = 0
let clock
let toggle = 0
let controllers
let controllerGrip
let controllerLine
let gamepadIndices
const buttonStates = {}
let workingMatrix
let binary

const pointer = new THREE.Vector2()
const spheres = []

const threshold = 0.01
const pointSize = 0.02
const width = 80
const length = 160
const rotateY = new THREE.Matrix4().makeRotationY(0.005)

start()

async function start() {
    try {
        await loadBinary()
        init()
    } catch (err) {
        console.error(err)
    }
}

function loadBinary() {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest()
        xhr.open("GET", "/assets/AXFBinaryPoints.binary", true)
        xhr.responseType = "arraybuffer"
        xhr.onload = function () {
            if (this.status >= 200 && this.status < 300) {
                var arrayBuffer = xhr.response; // Note: not xhr.responseText
                // console.log(arrayBuffer)
                var b = buffer.Buffer.from(arrayBuffer)
                binary = sizeStreamBean.ReadBinaryFile(b)
                resolve();
            } else {
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            }
        };
        xhr.onerror = function () {
            reject({
                status: this.status,
                statusText: xhr.statusText
            });
        };
        xhr.send();
    });
}

function randomColour() {
    return Math.random() * 0xffffff;
}

function generatePointCloudGeometry(sensor) {

    const geometry = new THREE.BufferGeometry();
    const numPoints = sensor.points.length;
    const positions = new Float32Array(numPoints * 3);
    const colors = new Float32Array(numPoints * 3);

    let k = 0;

    sensor.points.forEach((node, index) => {

        const x = node.x;
        const y = node.y;
        const z = node.z;

        // if (isNaN(x) || isNaN(y) || isNaN(z)) {
        //     console.log('point: ', index)
        // }

        positions[3 * k] = x / 8;
        positions[3 * k + 1] = y / 8;
        positions[3 * k + 2] = z / 8;

        // // const intensity = (y + 0.1) * 5;
        // const intensity = 1;
        // colors[3 * k] = color.r * intensity;
        // colors[3 * k + 1] = color.g * intensity;
        // colors[3 * k + 2] = color.b * intensity;

        const colour = new THREE.Color(randomColour())
        colors[3 * k] = colour.r;
        colors[3 * k + 1] = colour.g;
        colors[3 * k + 2] = colour.b;

        k++;

    })
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingBox();

    return geometry;

}

function generatePointcloud(sensor) {
    const geometry = generatePointCloudGeometry(sensor);
    const material = new THREE.PointsMaterial({ size: pointSize, vertexColors: true });
    return new THREE.Points(geometry, material);
}

function init() {

    const container = document.getElementById('container');

    scene = new THREE.Scene();

    clock = new THREE.Clock();

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.6, 3);
    camera.lookAt(scene.position);
    camera.updateMatrix();

    scene.add(new THREE.HemisphereLight(0x606060, 0x404040))

    const light = new THREE.DirectionalLight(0xffffff);
    light.position.set(1, 1, 1).normalize();
    scene.add(light);

    binary.forEach(sensor => {
        const pcBuffer = generatePointcloud(sensor);
        pcBuffer.scale.set(0.02, 0.02, 0.02);
        pcBuffer.position.set(0, -1, -2);
        scene.add(pcBuffer);
        pointclouds.push(pcBuffer)
    })

    // const pcBuffer = generatePointcloud(new THREE.Color(1, 0, 0), width, length);
    // pcBuffer.scale.set(5, 10, 10);
    // pcBuffer.position.set(- 5, 0, 0);
    // scene.add(pcBuffer);

    // const pcIndexed = generateIndexedPointcloud(new THREE.Color(0, 1, 0), width, length);
    // pcIndexed.scale.set(5, 10, 10);
    // pcIndexed.position.set(0, 0, 0);
    // scene.add(pcIndexed);

    // const pcIndexedOffset = generateIndexedWithOffsetPointcloud(new THREE.Color(0, 1, 1), width, length);
    // pcIndexedOffset.scale.set(5, 10, 10);
    // pcIndexedOffset.position.set(5, 0, 0);
    // scene.add(pcIndexedOffset);

    // pointclouds = [pcBuffer, pcIndexed, pcIndexedOffset];

    //

    const sphereGeometry = new THREE.SphereGeometry(0.02, 10, 10);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    for (let i = 0; i < 40; i++) {
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        scene.add(sphere);
        spheres.push(sphere);
    }

    //

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // controls = new OrbitControls(camera, renderer.domElement);
    // controls.target.set(0, 1.6, 0);
    // controls.update();   

    raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = threshold;

    workingMatrix = new THREE.Matrix4()

    stats = new Stats();
    container.appendChild(stats.dom);

    setupXR();
    // setEnvironment()

    window.addEventListener('resize', onWindowResize);
    // document.addEventListener('pointermove', onPointerMove);

    renderer.setAnimationLoop(render);

}

// function updateControllers(info) {

//     function onSelectStart() {
//         userData.selectPressed = true;
//     }

//     function onSelectEnd() {
//         children[0].scale.z = 0;
//         userData.selectPressed = false;
//         userData.selected = undefined;
//     }

//     function onSqueezeStart() {
//         userData.squeezePressed = true;
//         if (userData.selected !== undefined) {
//             attach(userData.selected);
//             userData.attachedObject = userData.selected;
//         }
//     }

//     function onSqueezeEnd() {
//         userData.squeezePressed = false;
//         if (userData.attachedObject !== undefined) {
//             room.attach(userData.attachedObject);
//             userData.attachedObject = undefined;
//         }
//     }

//     function onDisconnected() {
//         const index = userData.index;
//         console.log(`Disconnected controller ${index}`);

//         if (controllers) {
//             const obj = (index == 0) ? controllers.right : controllers.left;

//             if (obj) {
//                 if (obj.controller) {
//                     const controller = obj.controller;
//                     while (controller.children.length > 0) controller.remove(controller.children[0]);
//                     scene.remove(controller);
//                 }
//                 if (obj.grip) scene.remove(obj.grip);
//             }
//         }
//     }

//     if (info.right !== undefined) {
//         const right = renderer.xr.getController(0);

//         let trigger = false, squeeze = false;

//         Object.keys(info.right).forEach((key) => {
//             if (key.indexOf('trigger') != -1) trigger = true; if (key.indexOf('squeeze') != -1) squeeze = true;
//         });

//         if (trigger) {
//             right.addEventListener('selectstart', onSelectStart);
//             right.addEventListener('selectend', onSelectEnd);
//         }

//         if (squeeze) {
//             right.addEventListener('squeezestart', onSqueezeStart);
//             right.addEventListener('squeezeend', onSqueezeEnd);
//         }

//         right.addEventListener('disconnected', onDisconnected);
//     }

//     if (info.left !== undefined) {
//         const left = renderer.xr.getController(1);

//         let trigger = false, squeeze = false;

//         Object.keys(info.left).forEach((key) => {
//             if (key.indexOf('trigger') != -1) trigger = true; if (key.indexOf('squeeze') != -1) squeeze = true;
//         });

//         if (trigger) {
//             left.addEventListener('selectstart', onSelectStart);
//             left.addEventListener('selectend', onSelectEnd);
//         }

//         if (squeeze) {
//             left.addEventListener('squeezestart', onSqueezeStart);
//             left.addEventListener('squeezeend', onSqueezeEnd);
//         }

//         left.addEventListener('disconnected', onDisconnected);
//     }
// }

function setupXR() {
    renderer.xr.enabled = true;
    const button = new VRButton(renderer);

    let controller = renderer.xr.getController(0);
    controller.addEventListener('connected', function (event) {
        fetchProfile(event.data, DEFAULT_PROFILES_PATH, DEFAULT_PROFILE).then(({ profile, assetPath }) => {
            const info = {
                name: profile.profileId,
                targetRayMode: event.data.targetRayMode
            }
            Object.entries(profile.layouts).forEach(([key, layout]) => {
                const components = {}
                Object.values(layout.components).forEach((component) => {
                    components[component.rootNodeName] = component.gamepadIndices
                })
                info[key] = components
            })
            createButtonStates(info.right)
            // updateControllers(info)
        })
    });
    controller.addEventListener('disconnected', function () {
        controller.remove(controller.children[0]);
        controller = null;
        controllerGrip = null;
    });
    const modelFactory = new XRControllerModelFactory();
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    const line = new THREE.Line(geometry);
    line.scale.z = 0;

    controllers = {
        right: buildController(0, line, modelFactory),
        left: buildController(1, line, modelFactory)
    }
}

function buildController(index, line, modelFactory) {
    const controller = renderer.xr.getController(index);
    controller.userData.selectPressed = false;
    controller.userData.index = index;
    if (line) controller.add(line.clone());
    scene.add(controller);
    let grip;
    if (modelFactory) {
        grip = renderer.xr.getControllerGrip(index);
        grip.add(modelFactory.createControllerModel(grip));
        scene.add(grip);
    }
    return { controller, grip };
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    render();
    stats.update();
}

function createButtonStates(components) {
    gamepadIndices = components;

    Object.keys(components).forEach((key) => {
        if (key.indexOf('touchpad') != -1 || key.indexOf('thumbstick') != -1) {
            buttonStates[key] = { button: 0, xAxis: 0, yAxis: 0 };
        } else {
            buttonStates[key] = 0;
        }
    })
}

function setEnvironment() {
    const loader = new RGBELoader().setDataType(THREE.UnsignedByteType);
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    loader.load('../../assets/hdr/factory.hdr', (texture) => {
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;
        pmremGenerator.dispose();
        scene.environment = envMap;
    }, undefined, (err) => {
        console.error('An error occurred setting the environment');
    });
}

function handleController(controller) {
    if (controller && controller.children.length) {
        controller.children[0].scale.z = 10

        workingMatrix.identity().extractRotation(controller.matrixWorld)
        raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld)
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(workingMatrix)

        // camera.applyMatrix4(rotateY);
        // camera.updateMatrixWorld();

        // raycaster.setFromCamera(pointer, camera);

        const intersections = raycaster.intersectObjects(pointclouds, false);
        intersection = (intersections.length) > 0 ? intersections[0] : null;

        if (toggle > 0.02 && intersection !== null) {

            spheres[spheresIndex].position.copy(intersection.point);
            spheres[spheresIndex].scale.set(1, 1, 1);
            spheresIndex = (spheresIndex + 1) % spheres.length;

            toggle = 0;

        }

        for (let i = 0; i < spheres.length; i++) {

            const sphere = spheres[i];
            sphere.scale.multiplyScalar(0.98);
            sphere.scale.clampScalar(0.01, 1);

        }

        toggle += clock.getDelta();
    }
}

function render() {
    stats.update()
    if (renderer.xr.isPresenting) {
        if (controllers) {
            Object.values(controllers).forEach((value) => {
                handleController(value.controller)
            })
        }
    }
    renderer.render(scene, camera)

}