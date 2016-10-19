import $ from 'jquery';
import _ from 'underscore';
import * as THREE from 'three';
import Agent from './Agent';
import Loader from './Loader';
import OrbitControls from './Orbit';

const CAMERATYPE = 'persp'; // or 'ortho'

class Environment {
  constructor(width, depth) {
    var self = this;
    this.width = width;
    this.depth = depth;
    this._setupScene();
    this.clock = new THREE.Clock();

    this.clear();
    this._setupLights();
    this.spawnGround();
    this.agents = [];
  }

  spawnGround() {
    var planeWidth = this.width,
        planeDepth = this.depth,
        planeGeometry = new THREE.PlaneGeometry(planeWidth, planeDepth),
      planeMaterial = new THREE.MeshLambertMaterial({
        opacity: 0.6,
        transparent: true,
        color: 0xAAAAAA,
        side: THREE.DoubleSide
      }),
        plane = new THREE.Mesh( planeGeometry, planeMaterial );
    plane.rotation.x = Math.PI / 2;
    this.place(plane, 0, 0, 0);
  }

  place(obj, x, y, z) {
    obj.position.set(x, y, z);
    this.scene.add(obj);
  }

  addAgent(user, cb) {
    var agent = new Agent(user, {
      x: _.random(-this.width/2, this.width/2),
      y: 0,
      z: _.random(-this.depth/2, this.depth/2)
    }, this, cb);
    this.agents.push(agent);
    return agent;
  }

  removeAgent(name) {
    var agent = _.find(this.agents, a => a.name == name);
    this.agents = _.without(this.agents, agent);
    agent.remove(this);
  }

  clear() {
    var self = this;
    for (var i = self.scene.children.length-1; i >= 0; i--) {
      var obj = self.scene.children[i];
      self.scene.remove(obj);
    }
  }

  render() {
    requestAnimationFrame(this.render.bind(this));
    if (!this.paused) {
      var delta = this.clock.getDelta();
      if (delta < 0.5) {
        // if the delta is really large,
        // (i.e. when the tab loses focus)
        // agents will take very large steps
        // and can end up off the map
        // so just ignore large deltas
        _.each(this.agents, function(agent) {
          agent.update(delta);
        });
      }
      this.renderer.render(this.scene, this.camera);
      this.controls.update();
    }
  }

  _setupScene() {
    var mainEl = document.getElementsByTagName('main')[0],
        width = window.innerWidth,
        height = window.innerHeight,
        aspect = width/height,
        D = 1;

    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      canvas: document.getElementById('irl')
    });
    this.renderer.setClearColor(0xffffff, 0);
    this.renderer.setSize(width, height);

    this.scene = new THREE.Scene();
    if (CAMERATYPE === 'persp') {
      this.camera = new THREE.PerspectiveCamera(45, aspect, .1, 20000);
      this.camera.zoom = 1;
    } else {
      this.camera = new THREE.OrthographicCamera(-D*aspect, D*aspect, D, -D, 1, 1000),
      camera.zoom = 0.08;
    }

    this.camera.position.set(-20, 20, 20);
    this.camera.lookAt(this.scene.position);
    this.camera.updateProjectionMatrix();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.maxPolarAngle = Math.PI/2 - 0.1;
    if (CAMERATYPE === 'persp') {
      this.controls.minDistance = 10;
      this.controls.maxDistance = 160;
    } else {
      this.controls.maxZoom = 0.2;
      this.controls.minZoom = 0.1;
    }

    var self = this;
    window.addEventListener('resize', function() {
      var width = mainEl.clientWidth,
          height = mainEl.clientHeight;
      self.camera.aspect = width/height;
      self.camera.updateProjectionMatrix();
      self.renderer.setSize(width, height);
    }, false);
  }

  _setupLights() {
    var pointLight = new THREE.PointLight(0xffffff, 0.3, 50);
    pointLight.position.set(0, 20, 0);
    this.scene.add(pointLight);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    this.scene.add(new THREE.HemisphereLight(0xCCF0FF, 0xFFA1C7, 0.3));
  }

  // to easily visually identify where the origin is (for debugging)
  origin() {
    var geometry = new THREE.BoxGeometry(0.2,50,0.2),
        material = new THREE.MeshLambertMaterial({
          color: 0x000000
        }),
        cube = new THREE.Mesh(geometry, material);
    cube.position.set(0,0,0);
    this.scene.add(cube);
  }
};

export default Environment;
