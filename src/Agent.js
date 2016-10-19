import $ from 'jquery';
import _ from 'underscore';
import Loader from './Loader';
import * as THREE from 'three';

var STATE = {
      idle: 'idle',
      walking: 'walking',
      intransit: 'intransit',
      chatting: 'chatting',
      working: 'working',
    },
    MOVING_STATES = [STATE.walking, STATE.intransit],
    ENGAGED_STATES = [STATE.chatting, STATE.working, STATE.intransit],
    SCALE = 1,
    YOFFSET = 0.5,
    THOUGHT_YOFFSET = 3,
    ACTION_CROSS_FADE = 0.1,
    MIN_ACTIVITY_TIME = 10,
    MAX_ACTIVITY_TIME = 20,
    SPEED = 5;


class Agent {
  constructor(user, spawnPos, env, cb) {
    this.env = env;
    this.name = user.screen_name;
    this.image = user.profile_image_url_https.replace('_normal', '');
    this.scheduled = [];
    this.loadMesh(spawnPos, cb);
  }

  loadMesh(pos, cb) {
    var self = this;
    Loader.loadSkinnedMesh('agent', function(mesh, animations) {
      Loader.loadTexture(self.image, function(tex) {
        mesh.material.materials[0].map = tex;
        self.afterLoadMesh(mesh, animations, pos);
        cb();
      });
    });
  }

  afterLoadMesh(mesh, animations, pos) {
    this._setupMesh(mesh, pos, SCALE);
    this._setupActions(this.mesh, animations);
    this.setState(STATE.idle);
    this.env.scene.add(this.mesh);
    this.env.agents.push(this);
  }

  setState(state) {
    this.state = state;
    this.moving = _.contains(MOVING_STATES, state);
    this.engaged = _.contains(ENGAGED_STATES, state);

    var actions = this.actions[state];
    if (actions) {
      var action = _.sample(actions);
      this.setAction(action);
      this._scheduleNextAction(actions);
    } else {
      // default to idle action
      this.setAction(this.actions[STATE.idle][0]);
    }
  }

  setAction(action) {
    action.enabled = true;
    action.play();
    if (this.action) {
      this.action.play();
      this.action.crossFadeTo(action, ACTION_CROSS_FADE);
    }
    this.action = action;
  }

  remove(office) {
    this.scheduled = [];
    this.mixer = null;
    if (this.usingObject) {
      this.usingObject.leave(this);
    }
    office.scene.remove(this.mesh);
  }

  goTo(pos, cb) {
    var self = this;
    this.setState(STATE.walking);
    this.currentTarget = new THREE.Vector3(pos.x, pos.y, pos.z);
    this.goToCallback = cb;
  }

  schedule(callback, timeout) {
    var event = {
      callback: callback,
      timer: timeout
    }
    this.scheduled.push(event);
    return event;
  }

  tickScheduled(delta) {
    var completed = [];
    _.each(this.scheduled, function(scheduled) {
      scheduled.timer -= delta;
      if (scheduled.timer <= 0) {
        scheduled.callback();
        completed.push(scheduled);
      }
    });
    this.scheduled = _.difference(this.scheduled, completed);
  }

  tick(delta) {
    this.updateThoughtPosition();
  }

  update(delta) {
    if (this.mixer) {
      this.mixer.update(delta);
      this.tickScheduled(delta);
      this.action.enabled = true;

      this.tick(delta);
      if (this.moving) {
        this.moveTowardsTarget(delta);
      }
    }
  }

  moveTowardsTarget(delta) {
    var self = this;
    var vel = this.currentTarget.clone().sub(this.mesh.position);
    if (vel.lengthSq() > 0.05 * 0.05) {
      vel.normalize();
      this.mesh.position.add(vel.multiplyScalar(delta * SPEED));
      this.mesh.lookAt(this.currentTarget);
    } else {
      // arrived
      this.setState(STATE.idle);
      if (this.goToCallback) {
        this.goToCallback(this);
        this.goToCallback = null;
      }
    }
  }

  get abovePosition() {
    if (this.mesh) {
      var pos = new THREE.Vector3();
      pos.setFromMatrixPosition(this.mesh.matrixWorld);
      pos.y += THOUGHT_YOFFSET; // a little y offset
      return toXYCoords(pos, this.env.camera);
    }
  }

  showThought(text, duration, cb) {
    var thought = document.createElement('div');
    thought.innerHTML = text;
    thought.className = 'agent-thought';
    document.body.appendChild(thought);
    this.thought = thought;
    this.updateThoughtPosition();

    var self = this;
    setTimeout(function() {
      self.thought.remove();
      self.thought = null;
      cb();
    }, duration);
  }

  updateThoughtPosition() {
    if (this.thought) {
      var pos = this.abovePosition;
      if (pos) {
        this.thought.style.top = pos.y + 'px';
        this.thought.style.left = pos.x + 'px';
      }
    }
  }

  _scheduleNextAction(actions) {
    if (this._scheduledAction) {
      this.scheduled = _.without(this.scheduled, this._scheduledAction);
    }
    if (actions.length > 1) {
      var self = this,
          duration = this.action._clip.duration + ACTION_CROSS_FADE/2;
      this._scheduledAction = this.schedule(function() {
        self.setAction(_.sample(actions));
      }, duration);
    }
  }

  _setupMesh(mesh, pos) {
    this.mesh = mesh;
    this.mesh.scale.set(SCALE, SCALE, SCALE);
    this.mesh.position.set(pos.x, YOFFSET, pos.z);
  }

  _setupActions(mesh, animations) {
    this.actions = {};
    this.mixer = new THREE.AnimationMixer(mesh);
    _.each(animations, this._setupAction.bind(this));
  }

  _setupAction(anim) {
    var action = this.mixer.clipAction(anim);
    var actionName = anim.name.split('.')[0].toLowerCase();
    if (!(actionName in this.actions)) {
      this.actions[actionName] = [];
    }
    action.setEffectiveWeight(1);
    this.actions[actionName].push(action);
  }
}

function toXYCoords(pos, camera) {
  var vector = pos.clone().project(camera);
  vector.x = (vector.x + 1)/2 * $('main').width();
  vector.y = -(vector.y - 1)/2 * $('main').height();
  return vector;
}

Agent.STATE = STATE;
Agent.MIN_ACTIVITY_TIME = MIN_ACTIVITY_TIME;
Agent.MAX_ACTIVITY_TIME = MAX_ACTIVITY_TIME;
export default Agent;
