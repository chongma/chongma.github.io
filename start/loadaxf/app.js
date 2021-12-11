import * as THREE from '../../libs/three/three.module.js';
import { VRButton } from './VRButton.js';
import { XRControllerModelFactory } from '../../libs/three/jsm/XRControllerModelFactory.js';
import { BoxLineGeometry } from '../../libs/three/jsm/BoxLineGeometry.js';
import { Stats } from '../../libs/stats.module.js';
import { OrbitControls } from '../../libs/three/jsm/OrbitControls.js';
// import * as AxfBean from '../../libs/axf-bean.js';

class App {
    constructor() {
        this.factor = 1 / 10000
        this.factor2 = 1 / 1000

        const container = document.createElement('div');
        document.body.appendChild(container);

        this.clock = new THREE.Clock();

        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 1.6, 3);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x505050);

        this.scene.add(new THREE.HemisphereLight(0x606060, 0x404040));

        const light = new THREE.DirectionalLight(0xffffff);
        light.position.set(1, 1, 1).normalize();
        this.scene.add(light);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.target.set(0, 1.6, 0);
        this.controls.update();

        this.stats = new Stats();

        this.initScene();
        this.setupVR();

        window.addEventListener('resize', this.resize.bind(this));

        this.renderer.setAnimationLoop(this.render.bind(this));
    }

    random(min, max) {
        return Math.random() * (max - min) + min;
    }

    initScene() {
        this.radius = 0.08;

        this.room = new THREE.LineSegments(
            new BoxLineGeometry(6, 6, 6, 10, 10, 10),
            new THREE.LineBasicMaterial({ color: 0x808080 })
        );
        this.room.geometry.translate(0, 3, 0);
        this.scene.add(this.room);

        const geometry = new THREE.IcosahedronBufferGeometry(this.radius, 2);

        for (let i = 0; i < 200; i++) {

            const object = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color: Math.random() * 0xffffff }));

            object.position.x = this.random(-2, 2);
            object.position.y = this.random(0, 4);
            object.position.z = this.random(-2, 2);

            this.room.add(object);

        }

        this.loadAxf()
        this.loadObj()
        const self = this
        setTimeout(function () {
            self.renderAxf()
            self.renderObj()
        }, 1000)

    }

    geometryLayer(spline, layerY) {
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        spline.nodes.forEach((node) => {
            const x = node.point.x;
            const y = layerY;
            const z = node.point.y;
            positions.push(x, y, z);
        });
        // console.log(positions);
        geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(positions, 3)
        );
        geometry.computeBoundingSphere();
        geometry.scale(this.factor, this.factor, this.factor);
        return geometry;
    }

    geometryFrontSilhouette(spline) {
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        spline.nodes.forEach((node, index) => {
            const x = node.point.x;
            const y = node.point.y;
            const z = 0;
            positions.push(x, y, z);
        });
        // console.log(positions);
        geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(positions, 3)
        );
        geometry.computeBoundingSphere();
        geometry.scale(this.factor, this.factor, this.factor);
        return geometry;
    }

    geometrySideSilhouette(spline) {
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        spline.nodes.forEach((node, index) => {
            const x = 0;
            const y = node.point.y;
            const z = node.point.x;
            positions.push(x, y, z);
        });
        // console.log(positions);
        geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(positions, 3)
        );
        geometry.computeBoundingSphere();
        geometry.scale(this.factor, this.factor, this.factor);
        return geometry;
    }

    // renderSpline(spline, linewidth) {
    //   const material = new THREE.LineBasicMaterial({
    //     linewidth,
    //     vertexColors: THREE.VertexColors
    //   });
    //   const line = new THREE.Line(spline, material);
    //   this.group.add(line);
    // }

    renderSplineColour(spline, linewidth, colour) {
        const material = new THREE.LineBasicMaterial({
            linewidth,
            color: colour
        });
        const line = new THREE.Line(spline, material);
        this.group.add(line);
    }

    randomColour() {
        return Math.random() * 0xffffff;
    }

    loadAxf() {
        var oReq = new XMLHttpRequest();
        oReq.open("GET", "/start/loadaxf/test.axf", true);
        oReq.responseType = "arraybuffer";

        const self = this

        oReq.onload = function (oEvent) {
            var arrayBuffer = oReq.response; // Note: not oReq.responseText
            console.log(arrayBuffer)
            var b = buffer.Buffer.from(arrayBuffer)
            self.axf = AxfBean.readAxf(b)
        };
        oReq.send(null);
    }

    renderAxf() {
        this.scene.remove(this.group);
        this.group = new THREE.Group();
        this.room.add(this.group);
        // this.renderer.setAnimationLoop(this.animate);
        // console.log(this.axf)
        if (this.axf) {
            const fcolour = this.randomColour();
            const scolour = this.randomColour();
            this.axf.bodyParts.forEach((bodypart) => {
                const colour = this.randomColour();
                bodypart.layers.forEach((layer) =>
                    this.renderSplineColour(
                        this.geometryLayer(layer.splineLayer.surface, layer.y),
                        1.5,
                        colour
                    )
                );
                if (bodypart.frontSilhouette) {
                    bodypart.frontSilhouette.forEach((sil) => {
                        this.renderSplineColour(
                            this.geometryFrontSilhouette(sil.spline),
                            4,
                            fcolour
                        );
                    });
                }
                if (bodypart.sideSilhouette) {
                    bodypart.sideSilhouette.forEach((sil) => {
                        this.renderSplineColour(
                            this.geometrySideSilhouette(sil.spline),
                            4,
                            scolour
                        );
                    });
                }
            });
        }
        this.group.position.x = 1
        this.group.position.y = 1
        this.group.position.z = -1
    }

    loadObj() {
        var oReq = new XMLHttpRequest();
        oReq.open("GET", "/start/loadaxf/test.obj", true);
        oReq.responseType = "arraybuffer";

        const self = this

        oReq.onload = function (oEvent) {
            var arrayBuffer = oReq.response; // Note: not oReq.responseText
            console.log(arrayBuffer)
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
            self.obj = vertices
        };
        oReq.send(null);
    }

    renderObj() {
        this.scene.remove(this.group2);
        this.group2 = new THREE.Group();
        this.room.add(this.group2);
        // this.renderer.setAnimationLoop(this.animate);
        // console.log(this.obj)
        if (this.obj) {
            const colour = this.randomColour();
            this.renderPointCloudColour(this.geometryPoints(), colour)
        }
        this.group2.position.x = -1
        this.group2.position.y = 0
        this.group2.position.z = -1
    }

    geometryPoints() {
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        this.obj.forEach((node, index) => {
            const x = node[0];
            const y = node[1];
            const z = node[2];
            positions.push(x, y, z);
        });
        // console.log(positions);
        geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(positions, 3)
        );
        geometry.computeBoundingSphere();
        geometry.scale(this.factor2, this.factor2, this.factor2);
        return geometry;
    }

    renderPointCloudColour(points, colour) {
        const material = new THREE.PointsMaterial({
            size: 0.01,
            color: colour
        });
        const cloud = new THREE.Points(points, material);
        this.group2.add(cloud);
    }

    setupVR() {
        this.renderer.xr.enabled = true;
        const button = new VRButton(this.renderer);
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        this.stats.update();

        this.renderer.render(this.scene, this.camera);
    }
}

export { App };