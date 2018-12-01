/*eslint global-require:off*/
/*global VMath: false */
/*global Z: false */

const local_storage = require('./local_storage.js');
const particle_data = require('./particle_data.js');

const { v4Build } = VMath;
const { min, max, PI } = Math;

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

export function main(canvas) {
  const glov_engine = require('./glov/engine.js');
  const glov_font = require('./glov/font.js');
  const random_seed = require('random-seed');

  const { defaults } = require('../common/util.js');

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
  // const font = glov_engine.font;

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
    v4Build(0.820, 0.522, 0.547, 1),
    v4Build(0.247, 0.820, 0.525, 1),
    v4Build(0.533, 0.247, 0.820, 1),
    v4Build(0.290, 0.208, 0.133, 1),
  ];
  const fluid_colors_glow = [
    v4Build(0.933, 0.400, 0.827, 1),
    v4Build(0.831, 0.933, 0.400, 1),
    v4Build(0.400, 0.827, 0.933, 1),
    v4Build(0.933, 0.827, 0.827, 1),
    v4Build(0.400, 0.933, 0.827, 1),
    v4Build(0.827, 0.400, 0.933, 1),
    v4Build(0.290, 0.208, 0.133, 1),
  ];

  // Cache key_codes
  const key_codes = glov_input.key_codes;
  const pad_codes = glov_input.pad_codes;

  let rand;
  let game_state;
  const PIPE_DIM = 6;
  const PIPE_TYPES = [
    'corner',
    'cross',
    'merge',
    'straight',
    't',
    'zig',
  ];

  function newPipe() {
    return {
      type: PIPE_TYPES[rand(PIPE_TYPES.length)],
      rot: rand(4),
    };
  }
  function newGame() {
    rand = random_seed.create(1234);
    game_state = {
      board: [],
      sources: [],
    };
    for (let ii = 0; ii < PIPE_DIM; ++ii) {
      let row = [];
      for (let jj = 0; jj < PIPE_DIM; ++jj) {
        row.push(newPipe());
      }
      game_state.board.push(row);
      if (rand(2)) {
        game_state.sources.push({
          type: rand(3),
          count: 1 + rand(3),
        });
      } else {
        game_state.sources.push(null);
      }
    }
  }


  const sprite_size = 160;
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
    const params_beaker = defaults({
      height: sprite_size * 1.5,
      origin: origin_0_0.origin,
    }, params_square);
    sprites.beaker_full = createSpriteSimple('beaker-full', sprite_size, sprite_size * 1.5, params_beaker);
    sprites.beaker_empty = createSpriteSimple('beaker-empty', sprite_size, sprite_size * 1.5,
      defaults({ layers: 1 }, params_beaker));

    sprites.meat = createSpriteSimple('meat', sprite_size, sprite_size, params_square);

    sprites.game_bg = createSpriteSimple('bg.png', 2560, 1600, {
      width: game_width,
      height: game_height,
      origin: [0, 0],
    });
  }

  function drawPipes(dt) {
    let rotateable = true;
    let { board, sources } = game_state;
    let x0 = 1440;
    let y0 = 160;
    // Sources
    for (let ii = 0; ii < sources.length; ++ii) {
      let s = sources[ii];
      if (s) {
        sprites.meat.drawDualTint({
          x: x0 + sprite_size * ii + sprite_size / 2,
          y: y0 - sprite_size / 2,
          z: Z.SPRITES,
          color: fluid_colors[s.type],
          color1: fluid_colors_glow[s.type],
          size: [1, 1],
        });
      }
    }

    // Pipes
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

          if (ret) {
            pipe.rot = (pipe.rot + 1) % 4;
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
      sprites.beaker_full.drawDualTint({
        x: x0 + sprite_size * ii,
        y: y0,
        z: Z.SPRITES,
        color: fluid_colors[0],
        color1: fluid_colors_glow[0],
        size: [1, 1],
      });
    }
  }

  function drawPipesUI(dt) {
    glov_ui.buttonText({
      x: 1440,
      y: 1360,
      text: 'Brew!'
    });
    glov_ui.buttonText({
      x: 2400 - glov_ui.button_width,
      y: 1360,
      text: 'Shop'
    });
  }

  const TOP = 0;
  const RIGHT = 1;
  const BOTTOM = 2;
  const LEFT = 3;
  const dx = [0, 1, 0, -1];
  const dy = [-1, 0, 1, 0];

  const connectivity = {
    'corner': [[TOP, RIGHT]],
    'cross': [[TOP, BOTTOM], [LEFT, RIGHT]],
    'merge': [[TOP, RIGHT, BOTTOM, LEFT]],
    'straight': [[TOP, BOTTOM]],
    't': [[TOP, RIGHT, BOTTOM]],
    'zig': [[TOP, RIGHT], [LEFT, BOTTOM]],
  };

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
    if (fill.uid === uid) {
      return;
    }
    if (fill.uid) {
      // already has a type
      if (type !== fill.type) {
        if (fill.type < 3) {
          // good mix
          let a = min(fill.type, type);
          let b = max(fill.type, type);
          fill.type = 3 + (b - 1) * 2 - a; // 0 + 1 = 3; 1 + 2 = 4; 2 + 0 = 5
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
    fill.uid = uid;

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
        row[jj].fill = [{ uid: 0 }, { uid: 0 }];
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
    drawPipes(dt);
    drawBeakers(dt);

    drawPipesUI(dt);

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

  }

  function pipesInit(dt) {
    glov_engine.setState(pipes);
    pipes(dt);
  }

  initGraphics();
  newGame();
  glov_engine.setState(pipesInit);
}
