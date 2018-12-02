/*eslint global-require:off*/
/*global VMath: false */
/*global Z: false */

const assert = require('assert');
const local_storage = require('./local_storage.js');
const particle_data = require('./particle_data.js');
const random_seed = require('random-seed');

const { v2Build, v3Add, v3Build, v3BuildZero, v3Max, v3Min, v3Sub, v4Build } = VMath;
const { ceil, min, max, PI } = Math;
const { defaults, merge, clone } = require('../common/util.js');

let DEBUG = String(document.location).indexOf('localhost') !== -1;

local_storage.storage_prefix = 'glovjs-playground';
window.Z = window.Z || {};
Z.BACKGROUND = 0;
Z.SPRITES = 10;
Z.PARTICLES = 20;

// let app = exports;
// Virtual viewport for our game logic
export const game_width = 2560;
export const game_height = 1600;

export let sprites = {};

const TOP = 0;
const RIGHT = 1;
const BOTTOM = 2;
const LEFT = 3;
const dx = [0, 1, 0, -1];
const dy = [-1, 0, 1, 0];

const PEN_X0 = 80;
const PEN_Y0 = 320;
const PEN_W = 1120;
const PEN_H = 944;
const sprite_size = 160;
const PET_SIZE = sprite_size;
const MULLIGAN_MAX = 3;
const POTENCY_MAX = 16;

const potency_to_increase = [
  0,
  1,
  2,
  2,
  3,
  3,
  3,
  3,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  4,
  5,
];

const connectivity = {
  'corner': [[TOP, RIGHT]],
  'cross': [[TOP, BOTTOM], [LEFT, RIGHT]],
  'merge': [[TOP, RIGHT, BOTTOM, LEFT]],
  'straight': [[TOP, BOTTOM]],
  't': [[TOP, RIGHT, BOTTOM]],
  'zig': [[TOP, RIGHT], [LEFT, BOTTOM]],
};

const PIPE_DIM = 6;
const PIPE_TYPES = [
  'corner',
  'cross',
  'merge',
  'straight',
  't',
  'zig',
];

const SPECIES = [
  'slime',
];

export function main(canvas) {
  const glov_engine = require('./glov/engine.js');
  const glov_font = require('./glov/font.js');

  glov_engine.startup({
    canvas,
    game_width,
    game_height,
    pixely: false,
  });

  const sound_manager = glov_engine.sound_manager;
  // const glov_camera = glov_engine.glov_camera;
  const glov_input = glov_engine.glov_input;
  const glov_sprite = glov_engine.glov_sprite;
  const glov_ui = glov_engine.glov_ui;
  const draw_list = glov_engine.draw_list;
  const font = glov_engine.font;

  glov_ui.scaleSizes(2560 / 1280);

  const createSpriteSimple = glov_sprite.createSpriteSimple.bind(glov_sprite);
  const createAnimation = glov_sprite.createAnimation.bind(glov_sprite);

  const color_white = v4Build(1, 1, 1, 1);
  const color_red = v4Build(1, 0, 0, 1);
  const color_yellow = v4Build(1, 1, 0, 1);

  const color_higlight = v4Build(0.898, 0.898, 0.898, 1);
  const color_pipe = v4Build(0.326, 0.380, 0.431, 1);

  const fluid_colors = [
    v4Build(0.820, 0.247, 0.541, 1),
    v4Build(0.541, 0.820, 0.247, 1),
    v4Build(0.247, 0.541, 0.820, 1),

    v4Build(0.820, 0.525, 0.247, 1),
    v4Build(0.247, 0.820, 0.525, 1),
    v4Build(0.525, 0.247, 0.820, 1),

    v4Build(0.290, 0.208, 0.133, 1), // poo
    v4Build(0.820, 0.820, 0.525, 1), // gold
  ];
  const fluid_colors_glow = [
    v4Build(0.933, 0.400, 0.827, 1),
    v4Build(0.831, 0.933, 0.400, 1),
    v4Build(0.400, 0.827, 0.933, 1),

    v4Build(0.933, 0.827, 0.400, 1),
    v4Build(0.400, 0.933, 0.827, 1),
    v4Build(0.827, 0.400, 0.933, 1),

    v4Build(0.145, 0.104, 0.067, 1),
    v4Build(0.933, 0.933, 0.827, 1),
  ];

  // Cache key_codes
  const key_codes = glov_input.key_codes;
  const pad_codes = glov_input.pad_codes;

  let rand;
  let game_state;

  function typeMix(type1, type2) {
    let a = min(type1, type2);
    let b = max(type1, type2);
    return 3 + (b - 1) * 2 - a; // 0 + 1 = 3; 1 + 2 = 4; 2 + 0 = 5
  }

  function newPipe() {
    return {
      type: PIPE_TYPES[rand(PIPE_TYPES.length)],
      rot: rand(4),
    };
  }
  function newPipes() {
    game_state.board = [];
    for (let ii = 0; ii < PIPE_DIM; ++ii) {
      let row = [];
      for (let jj = 0; jj < PIPE_DIM; ++jj) {
        row.push(newPipe());
      }
      game_state.board.push(row);
    }
  }

  function newSink() {
    return {
      value: v3Build(0, 0, 0),
      offset: rand.random() * 16,
    };
  }

  function randomizeArray(arr) {
    for (let ii = arr.length - 1; ii >= 0; --ii) {
      let idx = rand(ii + 1);
      let t = arr[ii];
      arr[ii] = arr[idx];
      arr[idx] = t;
    }
  }

  function randomOrder() {
    let difficulty = game_state.orders_done + 1;
    let options = [
      {
        type: 'potion',
        name: 'Pure Potion',
        min: [3 + difficulty * 2, null, null],
        max: [null, 0, 0],
      }, {
        type: 'potion',
        name: 'Golden Potion',
        min: [difficulty / 2, difficulty / 2, difficulty / 2],
        color: 7,
      }, {
        type: 'potion',
        name: 'Potion',
        min: [2 + difficulty * 1.5, null, null],
      }, {
        type: 'potion',
        name: 'Potion',
        min: [difficulty * 2, difficulty / 2, 0],
      }, {
        type: 'pet',
        name: 'Golden Pet',
        min: [difficulty / 2, difficulty / 2, difficulty / 2],
        color: 7,
      }, {
        type: 'pet',
        name: 'Specialized Pet',
        min: [2 + difficulty, null, null],
        max: [null, difficulty / 3, difficulty / 3],
      }, {
        type: 'pet',
        name: 'Pet',
        min: [difficulty, difficulty / 2, null],
      }, {
        type: 'pet',
        name: 'Strong Pet',
        color: 0,
        min: [2 + difficulty, null, null],
        no_random: true,
      }, {
        type: 'pet',
        name: 'Beautiful Pet',
        color: 0,
        min: [null, 2 + difficulty, null],
        no_random: true,
      }, {
        type: 'pet',
        name: 'Magic Pet',
        color: 0,
        min: [null, null, 2 + difficulty],
        no_random: true,
      }
    ];
    let order = options[rand(options.length)];
    if (difficulty === 10) {
      order = {
        type: 'potion',
        name: 'Ambrosia',
        min: [POTENCY_MAX, POTENCY_MAX, POTENCY_MAX],
        max: [POTENCY_MAX, POTENCY_MAX, POTENCY_MAX],
      };
    }
    let permute = [0, 1, 2];
    randomizeArray(permute);
    ['min', 'max'].forEach((field) => {
      if (order[field]) {
        // Swap order of all array parameters
        if (!order.no_random) {
          order[field] = order[field].map((v, idx) => order[field][permute[idx]]);
        }
        // Ceil all float values
        order[field] = order[field].map((v) => {
          if (v === null) {
            return null;
          }
          return ceil(v);
        });
      }
    });
    if (order.min) {
      for (let ii = 0; ii < 3; ++ii) {
        if (order.min[ii] !== null) {
          order.min[ii] = min(POTENCY_MAX, order.min[ii]);
        }
      }
    }
    return order;
  }

  function newGame() {
    rand = random_seed.create(3);
    game_state = {
      selected: null,
      board: [[]],
      sources: [],
      sinks: [],
      mulligan: 2,
      pen: [],
      orders: [],
      orders_done: 0,
    };
    game_state.orders.push(randomOrder());
    newPipes();
    let counts = [1, 2, 3];
    randomizeArray(counts);
    for (let ii = 0; ii < PIPE_DIM; ++ii) {
      if (ii < 3) {
        game_state.sources.push({
          type: ii,
          count: counts[ii],
        });
      } else {
        game_state.sources.push(null);
      }
      game_state.sinks.push(newSink());
    }
    randomizeArray(game_state.sources);
    let types = [0, 1, 2];
    randomizeArray(types);
    let sizes = [1, 2, 3];
    randomizeArray(sizes);
    for (let ii = 0; ii < 3; ++ii) {
      let size = sizes[ii];
      let value = v3BuildZero();
      value[types[ii]] = DEBUG ? 3 : 1;
      let order = [0,1,2,6];
      randomizeArray(order);
      let pet = {
        size,
        value,
        order,
        species: 'slime',
        pos: v2Build(
          PEN_X0 + rand(PEN_W - PET_SIZE * size),
          PEN_Y0 + rand(PEN_H - PET_SIZE)
        ),
        fed: true,
      };
      game_state.pen.push(pet);
    }
  }

  function calcBrew() {
    let { board, sinks } = game_state;
    let ret = [];
    for (let ii = 0; ii < sinks.length; ++ii) {
      let pipe = board[PIPE_DIM-1][ii];
      let con = connectivity[pipe.type];
      let check = (BOTTOM - pipe.rot + 4) % 4;

      let subset = -1;
      for (let kk = 0; kk < con.length; ++kk) {
        let conset = con[kk];
        for (let jj = 0; jj < conset.length; ++jj) {
          if (conset[jj] === check) {
            subset = kk;
          }
        }
      }

      if (subset === -1 || !pipe.fill[subset].uid) {
        ret.push(null);
      } else {
        ret.push(pipe.fill[subset]);
      }
    }
    return ret;
  }

  const output_from_type = [
    v3Build(2, 0, -1),
    v3Build(-1, 2, 0),
    v3Build(0, -1, 2),

    v3Build(1, 1, -1),
    v3Build(-1, 1, 1),
    v3Build(1, -1, 1),

    v3Build(-1, -1, -1),
  ];

  function doBrew() {
    let { sources, sinks } = game_state;

    // clear any old sources
    for (let ii = 0; ii < sources.length; ++ii) {
      if (sources[ii] && !sources[ii].count) {
        sources[ii] = null;
      }
    }

    let brew = calcBrew();
    let used = {};
    for (let ii = 0; ii < sinks.length; ++ii) {
      if (brew[ii] !== null) {
        v3Add(sinks[ii].value, output_from_type[brew[ii].type], sinks[ii].value);
        v3Max(sinks[ii].value, VMath.zero_vec, sinks[ii].value);
        v3Min(sinks[ii].value, [POTENCY_MAX, POTENCY_MAX, POTENCY_MAX], sinks[ii].value);
        assert(brew[ii].uid);
        merge(used, brew[ii].uid);
      }
    }
    // Drain sources if they went to any sink
    for (let ii = 0; ii < sources.length; ++ii) {
      if (used[ii + 1]) {
        let s = sources[ii];
        --s.count;
        if (!s.count) {
          s.type = 6;
        }
      }
    }

    if (!DEBUG) {
      newPipes();
    }
  }


  function initGraphics() {
    glov_sprite.preloadParticleData(particle_data);

    // sound_manager.loadSound('test');

    const origin_0_0 = glov_sprite.origin_0_0;

    sprites.white = createSpriteSimple('white', 1, 1, origin_0_0);

    const params_square = {
      layers: 2,
      width: sprite_size,
      height: sprite_size,
      // default middle, not origin: origin_0_0.origin,
    };

    sprites.pipes = {};
    PIPE_TYPES.forEach((label) => {
      sprites.pipes[label] = createSpriteSimple(`pipe-${label}`, sprite_size, sprite_size, params_square);
    });
    sprites.pets = {};
    SPECIES.forEach((species) => {
      sprites.pets[species] = createSpriteSimple(`pet_${species}`, sprite_size, sprite_size, {
        layers: 2,
        width: sprite_size,
        height: sprite_size,
        origin: origin_0_0.origin,
      });
    });
    const params_beaker = defaults({
      height: sprite_size * 1.5,
      origin: origin_0_0.origin,
    }, params_square);
    sprites.beaker_full = createSpriteSimple('beaker-full', sprite_size, sprite_size * 1.5, params_beaker);
    sprites.beaker_empty = createSpriteSimple('beaker-empty', sprite_size, sprite_size * 1.5,
      defaults({ layers: 1 }, params_beaker));
    sprites.beaker_select = createSpriteSimple('beaker-select', sprite_size, sprite_size * 1.5,
      defaults({ layers: 1 }, params_beaker));

    sprites.pet_select = [];
    for (let ii = 1; ii <= 3; ++ii) {
      sprites.pet_select[ii] = createSpriteSimple(`pet_select_${ii}.png`, sprite_size * ii, sprite_size, {
        width: sprite_size,
        height: sprite_size,
        origin: origin_0_0.origin
      });
    }

    sprites.meat = createSpriteSimple('meat', sprite_size, sprite_size, params_square);

    sprites.game_bg = createSpriteSimple('bg.png', 2560, 1600, {
      width: game_width,
      height: game_height,
      origin: [0, 0],
    });
  }

  function beakerType(value, max_size) {
    let sort = [0, 1, 2];
    sort.sort(function (a, b) {
      return value[b] - value[a];
    });
    if (!value[sort[0]]) {
      return -1;
    }
    if (max_size === 1 || !value[sort[1]] || value[sort[0]] - value[sort[1]] >= 3) {
      return sort[0];
    }
    if (max_size === 2 || !value[sort[2]] || value[sort[1]] - value[sort[2]] >= 3) {
      return typeMix(sort[0], sort[1]);
    }
    return 7;
  }



  const unmix = [
    [0, 0],
    [1, 1],
    [2, 2],
    [0, 1],
    [1, 2],
    [2, 0],
    null,
    null,
  ];

  function meatFromPetInternal(pet) {
    let value = pet.value;
    let sort = [0, 1, 2];
    sort.sort(function (a, b) {
      return value[b] - value[a];
    });
    value = sort.map((idx) => value[idx]);
    let total = sort[0] + sort[1] + sort[2];
    if (!value[0]) {
      return [6];
    }
    if (pet.size === 1) {
      return sort.slice(0, 1);
    } else if (pet.size === 2) {
      if (!value[1] || value[0] > total * 2 / 3) {
        return [sort[0], sort[0]];
      }
      return sort.slice(0, 2);
    } else {
      if (!value[1] || value[0] > total * 3 / 4) {
        return [sort[0], sort[0], sort[0]];
      }
      if (!value[2] || value[0] > total * 2 / 4) {
        return [sort[0], sort[0], sort[1]];
      }
      return sort;
    }
  }

  function meatFromPet(pet) {
    let meat = meatFromPetInternal(pet);
    let ret = [];
    for (let ii = 0; ii < pet.order.length; ++ii) {
      for (let jj = 0; jj < meat.length; ++jj) {
        if (meat[jj] === pet.order[ii]) {
          ret.push({ type: meat[jj], count: 0 });
        }
      }
    }
    for (let ii = 0; ii < pet.value.length; ++ii) {
      let v = pet.value[ii];
      while (v) {
        let any = false;
        for (let jj = 0; jj < ret.length; ++jj) {
          if (ret[jj].type === ii && v) {
            --v;
            ret[jj].count++;
            any = true;
          }
        }
        if (!any) {
          break;
        }
      }
    }
    ret = ret.filter((e) => e.count);
    return ret;
  }

  function drawSources(dt) {
    let { selected } = game_state;
    let sources = clone(game_state.sources);
    let x0 = 1440;
    let y0 = 160;

    // Check mouse over, predict sources
    if (selected && selected[0] === 'pet') {
      let pet = game_state.pen[selected[1]];
      let meat = meatFromPet(pet);
      let pet_at =-1;
      if (meat.length) {
        for (let ii = 0; ii < sources.length; ++ii) {
          let param = {
            x: x0 + sprite_size * ii,
            y: y0 - sprite_size,
            w: ((ii === sources.length - meat.length) ? meat.length : 1) * sprite_size,
            h: sprite_size
          };
          if (glov_input.clickHit(param)) {
            // TODO: Confirm modal if wasting existing souce?
            glov_ui.setMouseOver(`source_${ii}`);
            glov_ui.playUISound('button_click');
            for (let jj = 0; jj < meat.length; ++jj) {
              let idx = ii + jj;
              sources = game_state.sources;
              if (!sources[idx]) {
                sources[idx] = {};
              }
              sources[idx].count = meat[jj].count;
              sources[idx].type = meat[jj].type;
            }
            game_state.pen.splice(selected[1], 1);
            game_state.selected = null;
            break;
          } else if (glov_input.isMouseOver(param)) {
            glov_ui.setMouseOver(`source_${ii}`);
            pet_at = ii;
            break;
          }
        }
        if (pet_at !== -1) {
          for (let ii = 0; ii < meat.length; ++ii) {
            let idx = pet_at + ii;
            if (!sources[idx]) {
              sources[idx] = {};
            }
            sources[idx].count = meat[ii].count;
            sources[idx].type = meat[ii].type;
            sources[idx].predict = true;
          }
        }
      }
    }

    // Sources
    for (let ii = 0; ii < sources.length; ++ii) {
      let s = sources[ii];
      if (s) {
        let color = fluid_colors[s.type];
        if (s.predict) {
          color = v4Build(color[0], color[1], color[2], 0.5);
        }
        sprites.meat.drawDualTint({
          x: x0 + sprite_size * ii + sprite_size / 2,
          y: y0 - sprite_size / 2,
          z: Z.SPRITES,
          color: color,
          color1: fluid_colors_glow[s.type],
          size: [1, 1],
        });
      }
    }
  }

  function drawPipes(dt) {
    let rotateable = true;
    let { board, sources } = game_state;
    let x0 = 1440;
    let y0 = 160;

    for (let ii = 0; ii < board.length; ++ii) {
      let row = board[ii];
      for (let jj = 0; jj < row.length; ++jj) {
        let pipe = row[jj];
        let param = {
          x: x0 + sprite_size * jj,
          y: y0 + sprite_size * ii,
          w: sprite_size,
          h: sprite_size,
          z: Z.SPRITES,
          color: color_higlight,
          color1: color_pipe,
          size: [1, 1],
          rotation: PI * 2 * pipe.rot / 4,
        };
        if (rotateable && pipe.type !== 'cross' && pipe.type !== 'merge') {
          let { ret, state } = glov_ui.buttonShared(param);
          if (!ret) {
            param.button = 1;
            ret = ret || glov_ui.buttonShared(param).ret;
          }

          if (ret) {
            pipe.rot = (pipe.rot + (param.button ? 3 : 1)) % 4;
          }
          if (state === 'rollover') {
            const pad = 8;
            const scale = (sprite_size + pad * 2) / param.w;
            param.size = [scale, scale];
            param.z++;
          }
        }
        param.x += sprite_size / 2;
        param.y += sprite_size / 2;
        if (pipe.fill[0].uid) {
          param.color1 = fluid_colors[pipe.fill[0].type];
          param.color = fluid_colors_glow[pipe.fill[0].type];
        }
        if (pipe.type === 'zig' || pipe.type === 'cross') {
          let replace = (pipe.type === 'zig') ? 'corner' : 'straight';
          sprites.pipes[replace].drawDualTint(param);
          param.rotation += (pipe.type === 'zig') ? PI : PI / 2;
          if (pipe.fill[1].uid) {
            param.color1 = fluid_colors[pipe.fill[1].type];
            param.color = fluid_colors_glow[pipe.fill[1].type];
          } else {
            param.color1 = color_pipe;
            param.color = color_higlight;
          }
          sprites.pipes[replace].drawDualTint(param);
        } else {
          sprites.pipes[pipe.type].drawDualTint(param);
        }
      }
    }
  }

  function drawBeakers(dt) {
    let x0 = 1440;
    let y0 = 1120;
    for (let ii = 0; ii < PIPE_DIM; ++ii) {
      let b = game_state.sinks[ii];
      let type = beakerType(b.value, 3);
      let param = {
        x: x0 + sprite_size * ii,
        y: y0 + b.offset - 16,
        z: Z.SPRITES,
        size: [1, 1], // drawing
        w: sprite_size, // mouse
        h: sprite_size * 1.5,
      };
      if (type < 0) {
        sprites.beaker_empty.draw(param);
      } else {
        let selected = 0;
        if (glov_input.clickHit(param)) {
          glov_ui.setMouseOver(b);
          glov_ui.playUISound('select');
          game_state.selected = ['potion', ii];
          selected = 1;
        } else if (game_state.selected && game_state.selected[0] === 'potion' && game_state.selected[1] === ii) {
          selected = 0.75;
        }
        if (glov_input.isMouseOver(param)) {
          glov_ui.setMouseOver(b);
          if (!selected) {
            selected = 0.5;
          }
        }
        param.color = fluid_colors[type];
        param.color1 = fluid_colors_glow[type];
        sprites.beaker_full.drawDualTint(param);
        if (selected) {
          param.color = v4Build(1, 1, 1, selected);
          param.z--;
          sprites.beaker_select.draw(param);
        }
      }
    }
  }

  function nextDay() {
    let { pen } = game_state;
    for (let ii = 0; ii < pen.length; ++ii) {
      let pet = pen[ii];
      if (pet.fed) {
        pet.fed = false;
      } else {
        v3Max(v3Sub(pet.value, VMath.unit_vec, pet.value), VMath.zero_vec, pet.value);
      }
    }
    game_state.mulligan = min(game_state.mulligan + 1, MULLIGAN_MAX);
  }

  function drawPipesUI(dt) {
    let w = 310;
    if (game_state.selected) {
      if (game_state.selected[0] === 'potion') {
        if (glov_ui.buttonText({
          x: 1440 + (2400 - 1440 - w) / 2,
          y: 1360,
          text: 'Empty Beaker',
          w,
        })) {
          game_state.sinks[game_state.selected[1]] = newSink();
        }
      }
    } else {
      if (glov_ui.buttonText({
        x: 1440,
        y: 1360,
        text: 'Brew!',
        w,
      })) {
        doBrew();
        nextDay();
      }
      if (glov_ui.buttonText({
        x: 1440 + (2400 - 1440 - w) / 2,
        y: 1360,
        text: `New Pipes (${game_state.mulligan})`,
        w,
        disabled: !game_state.mulligan,
      })) {
        --game_state.mulligan;
        newPipes();
      }
      glov_ui.buttonText({
        x: 2400 - w,
        y: 1360,
        text: 'Shop',
        w
      });
    }
  }

  function feedPet(pet_idx, sink_idx) {
    let pet = game_state.pen[pet_idx];
    let sink = game_state.sinks[sink_idx];
    assert(pet);
    for (let ii = 0; ii < 3; ++ii) {
      pet.value[ii] += potency_to_increase[sink.value[ii]];
    }
    game_state.sinks[sink_idx] = newSink();
    pet.fed = true;
  }

  function drawPen(dt) {
    let { pen } = game_state;
    let sink_selected = game_state.selected && game_state.selected[0] === 'potion';
    let need_sort = false;
    for (let ii = 0; ii < pen.length; ++ii) {
      let pet = pen[ii];
      let type = beakerType(pet.value, pet.size);
      if (type === -1) {
        type = 6;
      }
      let param = {
        x: pet.pos[0],
        y: pet.pos[1],
        z: Z.SPRITES + pen.length - ii,
        color: fluid_colors[type],
        color1: fluid_colors_glow[type],
        size: [pet.size, 1], // drawing
        w: sprite_size * pet.size, // mouse
        h: sprite_size, // mouse
      };
      sprites.pets[pet.species].drawDualTint(param);

      let selected = 0;
      let selectable = sink_selected && !pet.fed || !game_state.selected && meatFromPet(pet).length;
      if (selectable && glov_input.clickHit(param)) {
        glov_ui.playUISound('select');
        selected = 1;
        if (sink_selected) {
          // Feed them!
          feedPet(ii, game_state.selected[1]);
          game_state.selected = null;
        } else {
          game_state.selected = ['pet', ii];
        }
      } else if (game_state.selected && game_state.selected[0] === 'pet' && game_state.selected[1] === ii) {
        selected = 0.75;
        let pen_param = {
          x: PEN_X0,
          y: PEN_Y0,
          w: PEN_W,
          h: PEN_H
        };
        let mpos;
        if ((mpos = glov_input.clickHit(pen_param))) {
          game_state.selected = null;
          pet.pos[0] = min(max(PEN_X0, mpos[0] - pet.size * sprite_size / 2),
            PEN_X0 + PEN_W - pet.size * sprite_size);
          pet.pos[1] = min(max(PEN_Y0, mpos[1] - sprite_size / 2), PEN_Y0 + PEN_H - sprite_size);
          need_sort = true;
        }
      }
      if (selectable && glov_input.isMouseOver(param)) {
        glov_ui.setMouseOver(pet);
        if (!selected) {
          selected = 0.5;
        }
      }
      if (selected) {
        param.color = v4Build(1, 1, 1, selected);
        param.z -= 0.5;
        sprites.pet_select[pet.size].draw(param);
      }
    }
    if (need_sort) {
      pen.sort(function (a, b) {
        let d = b.pos[1] - a.pos[1];
        if (d) {
          return d;
        }
        return a.pos[0] - b.pos[0];
      });
    }
  }

  function selectedMeetsOrder(order) {
    if (!game_state.selected) {
      return false;
    }
    if (game_state.selected[0] !== order.type) {
      return false;
    }
    let is_pet = order.type === 'pet';
    let holder = is_pet ? 'pen' : 'sinks';
    let thing = game_state[holder][game_state.selected[1]];
    if (order.color !== undefined) {
      if (order.color !== beakerType(thing.value, is_pet ? thing.size : 3)) {
        return false;
      }
    }
    if (order.min) {
      for (let ii = 0; ii < 3; ++ii) {
        if (order.min[ii] !== null && thing.value[ii] < order.min[ii]) {
          return false;
        }
      }
    }
    if (order.max) {
      for (let ii = 0; ii < 3; ++ii) {
        if (order.max[ii] !== null && thing.value[ii] > order.max[ii]) {
          return false;
        }
      }
    }
    return true;
  }

  function fulfillOrder(order_idx) {
    let order = game_state.orders[order_idx];
    let is_pet = order.type === 'pet';
    if (is_pet) {
      game_state.pen.splice(game_state.selected[1], 1);
    } else {
      game_state.sinks[game_state.selected[1]] = newSink();
    }
    game_state.selected = null;
    // TODO: reward
    game_state.orders_done++;
    game_state.orders.splice(order_idx, 1, randomOrder());
    while (game_state.orders.length < min(3, game_state.orders_done + 1)) {
      game_state.orders.push(randomOrder());
    }
  }

  const ORDERS_X0 = 80;
  const ORDERS_W = 1120;
  const ORDERS_PAD = 12;
  const ORDERS_Y0 = 1300;
  const ORDERS_H = 280;
  function drawOrders(dt) {
    let { orders } = game_state;

    const font_size = 48;
    let y = ORDERS_Y0;
    font.drawSizedAligned(null, ORDERS_X0, y, Z.UI, font_size, glov_font.ALIGN.HCENTER, ORDERS_W, 0,
      'Current Orders:');
    y += font_size;

    let y_save = y;
    for (let ii = 0; ii < orders.length; ++ii) {
      y = y_save;
      let order = orders[ii];
      let w = (ORDERS_W - ORDERS_PAD * 2) / 3;
      let x = ORDERS_X0 + ii * (w + ORDERS_PAD);
      if (orders.length === 1) {
        x = ORDERS_X0 + (ORDERS_W - w) / 2;
      } else if (orders.length === 2 && ii) {
        x += w + ORDERS_PAD;
      }
      let h = ORDERS_Y0 + ORDERS_H - y;
      let param = { x, y, w, h };
      if (game_state.selected) {
        if (selectedMeetsOrder(order)) {
          let { ret, state } = glov_ui.buttonShared(param);
          if (ret) {
            fulfillOrder(ii);
          }
          if (state === 'rollover') {
            param.color = color_white;
          } else {
            param.color = v4Build(0.5, 1, 0.5, 1);
          }
        } else {
          param.color = v4Build(0.3, 0.3, 0.3, 1);
        }
      }
      glov_ui.panel(param);
      y += ORDERS_PAD;
      font.drawSizedAligned(
        glov_font.styleColored(null, 0x000000ff),
        x, y, Z.UI, font_size, glov_font.ALIGN.HCENTER, w, 0,
        order.name);
      y += font_size;
      for (let jj = 0; jj < 3; ++jj) {
        let rule = null;
        if (order.min && order.max && order.min[jj] !== null && order.max[jj] !== null) {
          if (order.min[jj] === order.max[jj]) {
            rule = `=${order.min[jj]}`;
          } else {
            rule = `${order.min[jj]}-${order.max[jj]}`;
          }
        } else if (order.min && order.min[jj] !== null) {
          rule = `${order.min[jj]}+`;
        } else if (order.max && order.max[jj] !== null) {
          if (order.max[jj]) {
            rule = `${order.max[jj]}-`;
          } else {
            rule = '=0';
          }
        }
        if (rule) {
          font.drawSizedAligned(
            glov_font.styleColored(null, 0x000000ff),
            x, y, Z.UI, font_size, glov_font.ALIGN.HCENTER, w, 0,
            `Stat${jj}: ${rule}`);
          y += font_size;
        }
      }
      if (order.color) {
        font.drawSizedAligned(
          glov_font.styleColored(null, 0x000000ff),
          x, y, Z.UI, font_size, glov_font.ALIGN.HCENTER, w, 0,
          `Color: ${order.color}`);
        y += font_size;
      }
    }
  }

  function dofill(x, y, from_dir, type, uid) {
    if (x < 0 || y < 0 || x >= PIPE_DIM || y >= PIPE_DIM) {
      return;
    }
    let pipe = game_state.board[y][x];
    let con = connectivity[pipe.type];
    let check = (from_dir - pipe.rot + 4) % 4;

    let fill_to;
    let subset;
    for (let ii = 0; ii < con.length; ++ii) {
      let conset = con[ii];
      for (let jj = 0; jj < conset.length; ++jj) {
        if (conset[jj] === check) {
          fill_to = conset;
          subset = ii;
        }
      }
    }
    if (!fill_to) {
      return;
    }
    let fill = pipe.fill[subset];
    if (fill.uid && fill.uid[uid]) {
      return;
    }
    if (fill.uid) {
      // already has a type
      if (type !== fill.type) {
        if (fill.type < 3) {
          // good mix
          fill.type = typeMix(fill.type, type);
        } else {
          if (fill.type === 6 ||
            type === 0 && (fill.type === 3 || fill.type === 5) ||
            type === 1 && (fill.type === 3 || fill.type === 4) ||
            type === 2 && (fill.type === 4 || fill.type === 5)
          ) {
            // already has this color, cancel
            return;
          }
          // bad mix
          fill.type = 6;
        }
      }
    } else {
      fill.type = type;
    }
    fill.uid = fill.uid || {};
    fill.uid[uid] = true;

    // recurse!
    for (let ii = 0; ii < fill_to.length; ++ii) {
      if (fill_to[ii] !== check) {
        let dir = (fill_to[ii] + pipe.rot) % 4;
        dofill(x + dx[dir], y + dy[dir], (dir + 2) % 4, type, uid);
      }
    }
  }

  function calcFlow() {
    let { board, sources } = game_state;
    for (let ii = 0; ii < board.length; ++ii) {
      let row = board[ii];
      for (let jj = 0; jj < row.length; ++jj) {
        row[jj].fill = [{ uid: null }, { uid: null }];
      }
    }
    for (let ii = 0; ii < sources.length; ++ii) {
      if (sources[ii] && sources[ii].count) {
        dofill(ii, 0, TOP, sources[ii].type, ii + 1);
      }
    }
  }

  function pipes(dt) {
    draw_list.queue(sprites.game_bg, 0, 0, Z.BACKGROUND);
    calcFlow();
    let have_clicks = glov_input.clicks[0] && glov_input.clicks[0].length;
    let selected_save = game_state.selected;

    drawSources(dt);
    drawPipes(dt);
    drawBeakers(dt);
    drawPen(dt);

    drawPipesUI(dt);
    drawOrders(dt);

    // sprites.test_tint.drawDualTint({
    //   x: test.character.x,
    //   y: test.character.y,
    //   z: Z.SPRITES,
    //   color: [1, 1, 0, 1],
    //   color1: [1, 0, 1, 1],
    //   size: [sprite_size, sprite_size],
    //   frame: sprites.animation.getFrame(dt),
    // });

    // let font_test_idx = 0;

    // glov_ui.print(glov_font.styleColored(null, 0x000000ff),
    //   test.character.x, test.character.y + (++font_test_idx * 20), Z.SPRITES,
    //   'TEXT!');
    // let font_style = glov_font.style(null, {
    //   outline_width: 1.0,
    //   outline_color: 0x800000ff,
    //   glow_xoffs: 3.25,
    //   glow_yoffs: 3.25,
    //   glow_inner: -2.5,
    //   glow_outer: 5,
    //   glow_color: 0x000000ff,
    // });
    // glov_ui.print(font_style,
    //   test.character.x, test.character.y + (++font_test_idx * glov_ui.font_height), Z.SPRITES,
    //   'Outline and Drop Shadow');

    if (game_state.selected && game_state.selected === selected_save && have_clicks) {
      game_state.selected = null;
    }
  }

  function pipesInit(dt) {
    glov_engine.setState(pipes);
    pipes(dt);
  }

  initGraphics();
  newGame();
  glov_engine.setState(pipesInit);
}
