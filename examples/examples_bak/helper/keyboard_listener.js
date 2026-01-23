const fs = require("fs");
const path = require("path");
const { GlobalKeyboardListener } = require("node-global-key-listener");

const logFile = path.join(__dirname, "keyboard.log");

// Track key states
const state = {
  CTRL: false,
  SHIFT: false,
  ALT: false,
  WIN: false
};

function log(message) {
  const time = new Date().toISOString();
  const line = `[${time}] ${message}`;

  console.log(line);
  fs.appendFileSync(logFile, line + "\n");
}

const gkl = new GlobalKeyboardListener();

gkl.addListener(event => {
  const { name, state: keyState } = event;

  const pressed = keyState === "DOWN";

  switch (name) {
    case "LEFT CTRL":
    case "RIGHT CTRL":
      if (pressed && !state.CTRL) {
        state.CTRL = true;
        log("CTRL pressed");
      } else if (!pressed && state.CTRL) {
        state.CTRL = false;
        log("CTRL released");
      }
      break;

    case "LEFT SHIFT":
    case "RIGHT SHIFT":
      if (pressed && !state.SHIFT) {
        state.SHIFT = true;
        log("SHIFT pressed");
      } else if (!pressed && state.SHIFT) {
        state.SHIFT = false;
        log("SHIFT released");
      }
      break;

    case "LEFT ALT":
    case "RIGHT ALT":
      if (pressed && !state.ALT) {
        state.ALT = true;
        log("ALT pressed");
      } else if (!pressed && state.ALT) {
        state.ALT = false;
        log("ALT released");
      }
      break;

    case "LEFT META":
    case "RIGHT META":
      if (pressed && !state.WIN) {
        state.WIN = true;
        log("WIN pressed");
      } else if (!pressed && state.WIN) {
        state.WIN = false;
        log("WIN released");
      }
      break;
  }
});

log("Global keyboard listener started (Node 22 compatible)");
