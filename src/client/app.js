/*eslint global-require:off*/
/*global VMath: false */
/*global Z: false */

const assert = require('assert');
const local_storage = require('./local_storage.js');
const particle_data = require('./particle_data.js');
const random_seed = require('random-seed');

const { v2Build, v3Add, v3Build, v3BuildZero, v3Max, v3Min, v3Sub, v4Build } = VMath;
const { ceil, min, max, PI } = Math;
const { defaults, merge, clone, titleCase } = require('../common/util.js');

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
const ORDERS_FINAL = 10;

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
assert(potency_to_increase.length - 1 === POTENCY_MAX);

let adjectives = {
  pet: [
    'Strong',
    'Beautiful',
    'Magical',
    'Wicked',
    'Ethereal',
    'Fey',
    'Withered',
    'Golden',
  ],
  potion: [
    'Strength',
    'Charisma',
    'Sorcery',
    'Bloodlust',
    'Charm',
    'Fire',
    'Poo',
    'Elixir',
  ],
};

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

const PIPE_DIST = [
  'corner',
  'corner',
  'cross',
  'cross',
  'straight',
  'straight',
  'zig',
  'zig',
  'zig',
  't',
  't',
  'merge',
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
  const glov_camera = glov_engine.glov_camera;
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

  let shop_up = false;
  let rand;
  let rand_orders;
  let game_state;

  function typeMix(type1, type2) {
    let a = min(type1, type2);
    let b = max(type1, type2);
    return 3 + (b - 1) * 2 - a; // 0 + 1 = 3; 1 + 2 = 4; 2 + 0 = 5
  }

  function newPipe() {
    return {
      type: PIPE_DIST[rand(PIPE_DIST.length)],
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
      offset: Math.random() * 16, // visual random, do not use seed
    };
  }

  function randomizeArray(arr, r) {
    r = r || rand;
    for (let ii = arr.length - 1; ii >= 0; --ii) {
      let idx = r(ii + 1);
      let t = arr[ii];
      arr[ii] = arr[idx];
      arr[idx] = t;
    }
  }

  function randomOrder(type) {
    let difficulty = game_state.orders_done + 1; // 1 - 8
    let options = [
      {
        type: 'potion',
        name: 'Pure Potion',
        min: [4 + difficulty * 0.75, null, null],
        max: [null, 0, 0],
      }, {
        type: 'potion',
        name: 'Potion of Elixir',
        min: [1 + difficulty / 2, 1 + difficulty / 2, 1 + difficulty / 2],
        color: 7,
      }, {
        type: 'potion',
        name: 'Potion',
        min: [3 + difficulty * 0.5, null, null],
      }, { // double odds
        type: 'potion',
        name: 'Potion',
        min: [3 + difficulty * 0.5, null, null],
      }, {
        type: 'potion',
        name: 'Potion',
        min: [1 + difficulty, difficulty / 2, null],
      }, {
        type: 'potion',
        name: 'Ptn of Bloodlust',
        color: 3,
        min: [1 + difficulty, 1 + difficulty, null],
        no_random: true,
      }, {
        type: 'potion',
        name: 'Potion of Charm',
        color: 4,
        min: [null, 1 + difficulty, 1 + difficulty],
        no_random: true,
      }, {
        type: 'potion',
        name: 'Potion of Fire',
        color: 5,
        min: [1 + difficulty, null, 1 + difficulty],
        no_random: true,
      }, {
        type: 'pet',
        name: 'Golden Pet',
        min: [difficulty / 2, difficulty / 2, difficulty / 2],
        color: 7,
      }, {
        type: 'pet',
        name: 'Specialized Pet',
        min: [3 + difficulty * 0.75, null, null],
        max: [null, difficulty / 3, difficulty / 3],
      }, {
        type: 'pet',
        name: 'Pet',
        min: [1 + difficulty, difficulty / 2, null],
      }, { // double odds
        type: 'pet',
        name: 'Pet',
        min: [1 + difficulty, difficulty / 2, null],
      }, {
        type: 'pet',
        name: 'Strong Pet',
        color: 0,
        min: [2 + difficulty, null, null],
        no_random: true,
      }, {
        type: 'pet',
        name: 'Beautiful Pet',
        color: 1,
        min: [null, 2 + difficulty, null],
        no_random: true,
      }, {
        type: 'pet',
        name: 'Magic Pet',
        color: 2,
        min: [null, null, 2 + difficulty],
        no_random: true,
      }
    ];
    options = options.filter((order) => order.type === type);
    let order = options[rand_orders(options.length)];
    if (!game_state.endless && game_state.orders_done + game_state.orders.length + 1 === ORDERS_FINAL) {
      order = {
        type: 'potion',
        name: 'Ambrosia',
        note: '(Potion)',
        min: [POTENCY_MAX - 1, POTENCY_MAX - 1, POTENCY_MAX - 1],
        max: [POTENCY_MAX, POTENCY_MAX, POTENCY_MAX],
      };
    }
    let permute = [0, 1, 2];
    randomizeArray(permute, rand_orders);
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
  function randomOrderProtected() {
    let order;
    let tries = 0;
    while (tries < 10) {
      order = randomOrder(game_state.next_order_type);
      let good = true;
      for (let ii = 0; ii < game_state.orders.length; ++ii) {
        if (JSON.stringify(game_state.orders[ii]) === JSON.stringify(order)) {
          tries++;
          good = false;
        }
      }
      if (good) {
        break;
      }
    }
    game_state.next_order_type = game_state.next_order_type === 'pet' ? 'potion' : 'pet';
    return order;
  }

  function newShop() {
    let colors = [0, 1, 2];
    let sizes = [1, 2, 3];
    randomizeArray(colors);
    randomizeArray(sizes);
    return colors.map(function (c, idx) {
      let ret = {
        value: v3BuildZero(),
        size: sizes[idx],
        species: SPECIES[rand(SPECIES.length)],
        fed: true,
      };
      ret.value[c] = 3;
      return ret;
    });
  }

  function newPet(data) {
    let order = [0,1,2,6];
    randomizeArray(order);
    return {
      size: data.size,
      value: data.value,
      species: data.species,
      order,
      pos: v2Build(
        PEN_X0 + rand(PEN_W - PET_SIZE * data.size),
        PEN_Y0 + rand(PEN_H - PET_SIZE)
      ),
      fed: true,
    };
  }

  function sortPens() {
    game_state.pen.sort(function (a, b) {
      let d = b.pos[1] - a.pos[1];
      if (d) {
        return d;
      }
      return a.pos[0] - b.pos[0];
    });
  }

  function newGame() {
    shop_up = false;
    rand = random_seed.create(3);
    rand_orders = random_seed.create(123);
    game_state = {
      endless: false,
      selected: null,
      board: [[]],
      sources: [],
      sinks: [],
      mulligan: 2,
      gp: 0,
      turns: 0,
      pen: [],
      orders: [],
      orders_done: 0,
      shop: newShop(),
      next_order_type: 'pet'
    };
    game_state.orders.push(randomOrderProtected());
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
      let species = SPECIES[rand(SPECIES.length)];
      let size = sizes[ii];
      let value = v3BuildZero();
      value[types[ii]] = 3;
      game_state.pen.push(newPet({
        size, value, species,
      }));
    }
    sortPens();
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

    v3Build(2, 2, -1),
    v3Build(-1, 2, 2),
    v3Build(2, -1, 2),

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

    newPipes();
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
      sprites.pets[`${species}_hungry`] = createSpriteSimple(`pet_${species}_hungry`, sprite_size, sprite_size, {
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

    sprites.icons = createSpriteSimple('icons', [128, 128], [128, 128], {
      layers: 1,
      width: 1,
      height: 1,
      origin: origin_0_0.origin,
    });

    sprites.meat = createSpriteSimple('meat', sprite_size, sprite_size, params_square);

    sprites.game_bg = createSpriteSimple('bg.png', 2560, 1600, {
      width: game_width,
      height: game_height,
      origin: [0, 0],
    });
  }

  function muchGreater(a, b) {
    return a - b >= 3 || a >= b * 2;
  }

  function beakerType(value, max_size) {
    let sort = [0, 1, 2];
    sort.sort(function (a, b) {
      return value[b] - value[a];
    });
    if (!value[sort[0]]) {
      return -1;
    }
    if (max_size === 1 || !value[sort[1]] || muchGreater(value[sort[0]], value[sort[1]])) {
      return sort[0];
    }
    if (max_size === 2 || !value[sort[2]] || muchGreater(value[sort[1]], value[sort[2]])) {
      return typeMix(sort[0], sort[1]);
    }
    return 7;
  }


  function meatFromPetInternal(pet) {
    let value = pet.value;
    let sort = [0, 1, 2];
    sort.sort(function (a, b) {
      return value[b] - value[a];
    });
    value = sort.map((idx) => value[idx]);
    let total = value[0] + value[1] + value[2];
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
    ret = ret.map((e) => {
      e.count = potency_to_increase[min(potency_to_increase.length - 1, e.count)];
      return e;
    });
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
        let param = {
          x: x0 + sprite_size * ii + sprite_size / 2,
          y: y0 - sprite_size / 2,
          z: Z.SPRITES,
          color: color,
          color1: fluid_colors_glow[s.type],
          size: [1, 1],
        };
        sprites.meat.drawDualTint(param);
        let text_color = 0x00000040;
        if (glov_input.isMouseOver({
          x: param.x - sprite_size / 2,
          y: param.y - sprite_size / 2,
          w: sprite_size,
          h: sprite_size,
        })) {
          text_color = 0x000000A0;
          glov_ui.drawTooltip({
            x: param.x - sprite_size,
            y: param.y + sprite_size / 2,
            tooltip: `These ingredients can be used in ${s.count} more brew${s.count === 1 ? '' : 's'}` +
              ' (any number of potions per brew)',
          });
        }
        font.drawSizedAligned(glov_font.styleColored(null, text_color),
          param.x, param.y + 30, param.z + 1, 48, glov_font.ALIGN.HVCENTER, 0, 0,
          `${s.count}`);
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
        if (rotateable && pipe.type !== 'merge') {
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
          param.z += 0.01;
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
    let brew = calcBrew();
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

      let over = false;
      if (type < 0) {
        if (brew[ii] && glov_input.isMouseOver(param)) {
          over = true;
        }

        sprites.beaker_empty.draw(param);
      } else {
        let selected = 0;
        if (glov_input.clickHit(param)) {
          over = true;
          glov_ui.playUISound('select');
          game_state.selected = ['potion', ii];
          selected = 1;
        } else if (game_state.selected && game_state.selected[0] === 'potion' && game_state.selected[1] === ii) {
          selected = 0.75;
        }
        if (glov_input.isMouseOver(param)) {
          over = true;
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

      if (over) {
        glov_ui.setMouseOver(b);
        let tooltip_w = 480;
        let pad = 16;
        let tooltip_x = param.x + (sprite_size - tooltip_w) / 2;
        let tooltip_y0 = y0 + sprite_size * 1.2;
        let tooltip_y = tooltip_y0 + pad;
        let z = Z.TOOLTIP;
        let font_size = 48;
        let style = glov_font.styleColored(null, 0x000000ff);
        font.drawSizedAligned(style, tooltip_x, tooltip_y, z, font_size, glov_font.ALIGN.HCENTER, tooltip_w, 0,
          type < 0 ? 'Empty Potion' : `Potion of ${adjectives.potion[type]}`);
        tooltip_y += font_size;
        let output = brew[ii] ? output_from_type[brew[ii].type] : [0,0,0];
        for (let jj = 0; jj < 3; ++jj) {
          if (b.value[jj] || output[jj]) {
            let font_w = font.drawSizedAligned(style, tooltip_x, tooltip_y, z, font_size, glov_font.ALIGN.HCENTER,
              tooltip_w, 0, `  = ${b.value[jj]}${output[jj] ? ` ${output[jj] > 0 ? '(+' : '('}${output[jj]})` : ''}`);
            let icon_size = font_size;
            sprites.icons.draw({
              x: tooltip_x + (tooltip_w - font_w + font_size) / 2 - icon_size,
              y: tooltip_y,
              z: z + 1,
              size: [icon_size, icon_size],
              frame: jj,
            });
            tooltip_y += font_size;
          }
        }

        glov_ui.panel({
          x: tooltip_x,
          y: tooltip_y0,
          z: Z.TOOLTIP - 1,
          w: tooltip_w,
          h: tooltip_y + pad - tooltip_y0,
        });
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

    if (game_state.orders.length < min(3, game_state.orders_done + 1)) {
      if (game_state.endless || game_state.orders_done + game_state.orders.length < ORDERS_FINAL) {
        let order = randomOrderProtected();
        if (game_state.orders.length === 2) {
          game_state.orders.splice(1, 0, order);
        } else {
          game_state.orders.push(order);
        }
      }
    }

    game_state.shop = newShop();
    game_state.mulligan = min(game_state.mulligan + 1, MULLIGAN_MAX);
    game_state.turns++;
  }

  function drawStatus(dt) {
    let x = 1440 + 80;
    let w = 960 - 80 * 2;
    let y = 1360 + 90;
    let style = null;

    glov_ui.print(style, x, y, Z.UI, `Turns: ${game_state.turns}`);
    font.drawSizedAligned(style, x, y, Z.UI, 48, glov_font.ALIGN.HRIGHT, w, 0, `GP: ${game_state.gp}`);
    y += 48;
    glov_ui.print(style, x, y, Z.UI, `Orders Completed: ${game_state.orders_done}` +
      `${game_state.endless ? '' : ` / ${ORDERS_FINAL}`}`);
    y += 48;
  }

  function drawPipesUI(dt) {
    let w = 310;
    if (game_state.selected) {
      if (game_state.selected[0] === 'potion') {
        if (glov_ui.buttonText({
          x: 1440 + (2400 - 1440 - w) / 2,
          y: 1360,
          text: 'Empty Potion',
          w,
          tooltip: 'Empty the currently selected potion, gaining nothing.  Why would you do this?',
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
        tooltip: 'Advances time.  Consume 1 of any ingredient used in any potion, and add to the' +
          ' potions.  Also, any hungry pets will lose 1 of each stat.',
        tooltip_width: 1200,
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
        tooltip: `Generate a new layout of pipes in your alchemical workshop.  You can do this ${game_state.mulligan}` +
          ' times, and once more every Brew.',
        tooltip_width: 1200,
      })) {
        --game_state.mulligan;
        newPipes();
      }
      if (glov_ui.buttonText({
        x: 2400 - w,
        y: 1360,
        text: 'Shop',
        w,
        tooltip: 'Spend GP to buy new pets',
        tooltip_width: 700,
      })) {
        // display shop
        shop_up = true;
      }
    }
  }

  function feedPet(pet_idx, sink_idx) {
    let pet = game_state.pen[pet_idx];
    let sink = game_state.sinks[sink_idx];
    assert(pet);
    for (let ii = 0; ii < 3; ++ii) {
      pet.value[ii] += sink.value[ii];
    }
    game_state.sinks[sink_idx] = newSink();
    pet.fed = true;
  }

  function petWidth(pet) {
    return (1 + 0.5 * (pet.size - 1)) * sprite_size;
  }
  function petHeight(pet) {
    return (1 + 0.5 * (pet.size - 1)) * sprite_size;
  }
  function drawPet(pet, x, y, z) {
    let type = beakerType(pet.value, 3);
    if (type === -1) {
      type = 6;
    }
    let w = petWidth(pet);
    let h = petHeight(pet);
    let param = {
      x, y, z,
      color: fluid_colors[type],
      color1: fluid_colors_glow[type],
      size: [w / sprite_size, h / sprite_size], // drawing
      w, h, // mouse
      type,
    };
    sprites.pets[`${pet.species}${pet.fed ? '' : '_hungry'}`].drawDualTint(param);
    return param;
  }

  function drawPen(dt) {
    let { pen } = game_state;
    let sink_selected = game_state.selected && game_state.selected[0] === 'potion';
    let need_sort = false;
    for (let ii = 0; ii < pen.length; ++ii) {
      let pet = pen[ii];
      let param = drawPet(pet, pet.pos[0], pet.pos[1], Z.SPRITES + pen.length - ii);
      let type = param.type;

      let selected = 0;
      let over = false;
      let selectable = sink_selected && !pet.fed || !game_state.selected && meatFromPet(pet).length;
      if (selectable && glov_input.clickHit(param)) {
        glov_ui.playUISound('select');
        over = true;
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
      if (glov_input.isMouseOver(param)) {
        over = true;
        if (selectable && !selected) {
          selected = 0.5;
        }
      }
      if (selected) {
        param.color = v4Build(1, 1, 1, selected);
        param.z -= 0.5;
        sprites.pet_select[1/*pet.size*/].draw(param);
      }

      if (over) {
        glov_ui.setMouseOver(pet);
        let tooltip_w = 400;
        let pad = 16;
        let tooltip_x = param.x + (sprite_size * pet.size - tooltip_w) / 2;
        if (tooltip_x < glov_camera.x0()) {
          tooltip_x = glov_camera.x0();
        }
        let tooltip_y0 = param.y + sprite_size;
        let tooltip_y = tooltip_y0 + pad;
        let z = Z.TOOLTIP;
        let font_size = 48;
        let style = glov_font.styleColored(null, 0x000000ff);
        font.drawSizedAligned(style, tooltip_x, tooltip_y, z, font_size, glov_font.ALIGN.HCENTER, tooltip_w, 0,
          titleCase(`${adjectives.pet[type]} ${pet.species}`));
        tooltip_y += font_size;
        let output = pet.fed ? [0,0,0] : [-1, -1, -1];
        // if a potion is selected, use that here
        let sel_pot = game_state.selected && game_state.selected[0] === 'potion';
        if (sel_pot && !pet.fed) {
          let sink = game_state.sinks[game_state.selected[1]];
          for (let jj = 0; jj < 3; ++jj) {
            output[jj] = sink.value[jj];
          }
        }
        for (let jj = 0; jj < 3; ++jj) {
          if (pet.value[jj] || output[jj]) {
            let font_w = font.drawSizedAligned(style, tooltip_x, tooltip_y, z, font_size, glov_font.ALIGN.HCENTER,
              tooltip_w, 0, `  = ${pet.value[jj]}${output[jj] ? ` ${output[jj] > 0 ? '(+' : '('}${output[jj]})` : ''}`);
            let icon_size = font_size;
            sprites.icons.draw({
              x: tooltip_x + (tooltip_w - font_w + font_size) / 2 - icon_size,
              y: tooltip_y,
              z: z + 1,
              size: [icon_size, icon_size],
              frame: jj,
            });
            tooltip_y += font_size;
          }
        }
        if (sel_pot && pet.fed) {
          font.drawSizedAligned(style, tooltip_x, tooltip_y, z, font_size, glov_font.ALIGN.HCENTER, tooltip_w, 0,
            'Satiated.');
          tooltip_y += font_size;
          font.drawSizedAligned(style, tooltip_x, tooltip_y, z, font_size, glov_font.ALIGN.HCENTER, tooltip_w, 0,
            'Cannot feed.');
          tooltip_y += font_size;
        } else if (sel_pot) {
          font.drawSizedAligned(style, tooltip_x, tooltip_y, z, font_size, glov_font.ALIGN.HCENTER, tooltip_w, 0,
            'Click to feed.');
          tooltip_y += font_size;
        } else if (!pet.fed) {
          font.drawSizedAligned(style, tooltip_x, tooltip_y, z, font_size, glov_font.ALIGN.HCENTER, tooltip_w, 0,
            'Hungry!');
          tooltip_y += font_size;
        }

        glov_ui.panel({
          x: tooltip_x,
          y: tooltip_y0,
          z: Z.TOOLTIP - 1,
          w: tooltip_w,
          h: tooltip_y + pad - tooltip_y0,
        });
      }
    }
    if (need_sort) {
      sortPens();
    }
  }

  function selectedMeetsOrder(order) {
    if (!game_state.selected) {
      return false;
    }
    if (game_state.selected[0] !== order.type) {
      return false;
    }
    if (DEBUG && glov_input.isKeyDown(key_codes.SHIFT)) {
      return true;
    }
    let is_pet = order.type === 'pet';
    let holder = is_pet ? 'pen' : 'sinks';
    let thing = game_state[holder][game_state.selected[1]];
    if (order.color !== undefined) {
      if (order.color !== beakerType(thing.value, 3)) {
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
    game_state.gp += 2;
    game_state.orders_done++;
    game_state.orders.splice(order_idx, 1);
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
      'Current Orders (Reward: 2 GP each)');
    y += font_size;

    if (!orders.length) {
      font.drawSizedAligned(null, ORDERS_X0, y + font_size, Z.UI, font_size, glov_font.ALIGN.HCENTER, ORDERS_W, 0,
        'A new order will appear when you Brew');
      if (!game_state.endless && game_state.orders_done === ORDERS_FINAL) {
        // TODO: high score screen here
        glov_ui.modalDialog({
          title: 'You win!',
          text: 'Congratulations, you have brewed the ultimate potion, Ambrosia, and fulfilled all other orders.' +
            ' Consider yourself a hero.  Click OK to continue in Endless Mode, if you really want to.',
          buttons: {
            'OK': function () {
              game_state.endless = true;
            },
          }
        });
      }
    }

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
            param.color = v4Build(0.75, 1, 0.75, 1);
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

      if (order.note !== undefined) {
        font.drawSizedAligned(
          glov_font.styleColored(null, 0x000000ff),
          x, y, Z.UI, font_size, glov_font.ALIGN.HCENTER, w, 0,
          order.note);
        y += font_size;
      }

      let all_same = true;
      for (let jj = 1; jj < 3; ++jj) {
        if (order.min && order.min[0] !== order.min[jj]) {
          all_same = false;
        }
        if (order.max && order.max[0] !== order.max[jj]) {
          all_same = false;
        }
      }
      for (let jj = 0; jj < 3; ++jj) {
        let rule = null;
        if (order.min && order.max && order.min[jj] !== null && order.max[jj] !== null) {
          if (order.min[jj] === order.max[jj]) {
            rule = `= ${order.min[jj]}`;
          } else {
            rule = `= ${order.min[jj]}-${order.max[jj]}`;
          }
        } else if (order.min && order.min[jj] !== null) {
          rule = `= ${order.min[jj]}+`; // Use ≥ ?  Not in font.
        } else if (order.max && order.max[jj] !== null) {
          if (order.max[jj]) {
            rule = `< ${order.max[jj] + 1}`;
          } else {
            rule = '= 0';
          }
        }
        if (rule) {
          let font_w = font.drawSizedAligned(
            glov_font.styleColored(null, 0x000000ff),
            x, y, Z.UI, font_size, glov_font.ALIGN.HCENTER, w, 0,
            `${all_same ? 'All' : '  '} ${rule}`);
          if (!all_same) {
            let icon_size = font_size;
            sprites.icons.draw({
              x: x + (w - font_w + font_size) / 2 - icon_size,
              y: y,
              z: Z.UI + 1,
              size: [icon_size, icon_size],
              frame: jj,
            });
          }
          y += font_size;
        }
        if (all_same) {
          break;
        }
      }
      if (order.color !== undefined) {
        font.drawSizedAligned(
          glov_font.styleColored(null, 0x000000ff),
          x, y, Z.UI, font_size, glov_font.ALIGN.HCENTER, w, 0,
          `"${adjectives[order.type][order.color]}"`);
        y += font_size;
      }
    }
  }

  function doShop(dt) {
    let z = Z.MODAL + 10;

    let w = game_width / 2;
    let x = (game_width - w) / 2;
    let y0 = game_height / 8;
    let pad = 24;
    let y = y0 + pad;
    let font_size = 48;
    let header_scale = 2;
    let style = glov_font.styleColored(null, 0x000000ff);

    font.drawSizedAligned(style, x, y, z, font_size, glov_font.ALIGN.HRIGHT, w, 0, `GP: ${game_state.gp}`);

    font.drawSizedAligned(style, x, y, z, font_size * header_scale, glov_font.ALIGN.HCENTER, w, 0, 'Pet Shop');
    y += font_size * header_scale + pad;
    font.drawSizedAligned(style, x, y, z, font_size, glov_font.ALIGN.HCENTER, w, 0, 'Free to a good home!');
    y += font_size;
    font.drawSizedAligned(glov_font.styleColored(style, 0x00000040), x, y, z, font_size, glov_font.ALIGN.HCENTER, w, 0,
      'For you, 1GP.');
    y += font_size;

    y += pad;

    let y_save = y;
    let sub_w = w / 3;
    let max_pet_height = petHeight({ size: 3 });
    for (let ii = 0; ii < game_state.shop.length; ++ii) {
      if (!game_state.shop[ii]) {
        continue;
      }
      y = y_save;
      let pet = game_state.shop[ii];
      let pet_w = petWidth(pet);
      let pet_h = petHeight(pet);
      let param = drawPet(pet, x + (ii + 0.5) * sub_w - pet_w / 2, y + font_size * 2 + (max_pet_height - pet_h) / 2, z);
      let title = titleCase(`${adjectives.pet[param.type]} ${pet.species}`);
      font.drawSizedAligned(style, x + ii * sub_w, y, z, font_size, glov_font.ALIGN.HCENTER, sub_w, 0, title);
      y += font_size;
      font.drawSizedAligned(style, x + ii * sub_w, y, z, font_size, glov_font.ALIGN.HCENTER, sub_w, 0,
        `Size: ${pet.size}`);
      y += font_size;
      y += max_pet_height;
      let icon_size = font_size;
      for (let jj = 0; jj < 3; ++jj) {
        let icon_x = x + ii * sub_w + jj * (sub_w - pad) / 3 + pad / 2;
        sprites.icons.draw({
          x: icon_x,
          y, z,
          size: [icon_size, icon_size],
          frame: jj,
        });
        font.drawSized(style, icon_x + icon_size, y, z, font_size, ` = ${pet.value[jj]}`);
      }
      y += font_size + 2;

      if (glov_ui.buttonText({
        x: x + ii * sub_w + pad,
        y: y,
        w: sub_w - pad * 2,
        z: z,
        text: 'Buy',
        disabled: game_state.gp < 1,
      })) {
        game_state.shop[ii] = null;
        game_state.gp -= 1;
        game_state.pen.push(newPet(pet));
        sortPens();
      }
      y += glov_ui.button_height;
    }

    y += pad;

    y += font.drawSizedWrapped(glov_font.styleColored(style, 0x333333ff), x, y, z, w, 0, font_size,
      'Buy new pets, and grow them, in order to fulfill orders or use them as' +
      ' ingredients in your alchemical work. Size affects how many taps (sources)' +
      ' a pet can supply, allowing a single, larger, balanced pet to output multiple' +
      ' ingredient types. Shop refreshes each time you Brew!');
    y += pad;

    // close button and Escape
    if (glov_ui.buttonText({
      x: x + (w - glov_ui.button_width) / 2,
      y, z,
      text: 'Leave Shop'
    }) || glov_input.keyDownHit(key_codes.ESCAPE)) {
      shop_up = false;
    }
    y += glov_ui.button_height;

    glov_ui.panel({
      x: x - pad,
      y: y0,
      w: w + pad * 2,
      h: y - y0 + pad * 2,
      z: z - 1,
    });

    glov_ui.menuUp();
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

    if (shop_up) {
      doShop(dt);
    }

    drawSources(dt);
    drawPipes(dt);
    drawBeakers(dt);
    drawPen(dt);

    drawPipesUI(dt);
    drawStatus(dt);
    drawOrders(dt);

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
