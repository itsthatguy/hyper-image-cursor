'use strict'

const { throttle } = require('lodash')
const { join } = require('path');
const fileUrl = require('file-url');

exports.decorateConfig = (config) => {
  const imageCursor = config.imageCursor || {};
  const CURSOR_PATH = fileUrl(join(__dirname, 'cursors', 'snes-link.gif'));
  const CURSOR_IDLE_PATH = fileUrl(join(__dirname, 'cursors', 'snes-link-idle.gif'));

  const BLINK_CSS = !config.cursorBlink
    ? `
      .cursor-node:before { animation: blink 1s ease infinite; }

      .cursor-node[hyper-cursor-moving]:before { animation: none !important; }

      @keyframes blink {
        50% { opacity: 0.5; }
      }
    `
    : '';

  const ACTIVE_CURSOR_CSS = imageCursor.activeCursor !== false
    ? `
      .cursor-node[hyper-cursor-moving]:before {
        background-image: url(${imageCursor.activeCursor || CURSOR_PATH});
      }
    `
    : '';

  const TERM_CSS = `
    ${config.termCSS || ''}
    ${BLINK_CSS}

    .cursor-node {
      animation: none !important;
      background-color: transparent !important;
      border: none !important;
    }

    .cursor-node:before {
      background-position: center;
      background-repeat: no-repeat;
      background-size: contain;
      background-image: url(${imageCursor.cursor || CURSOR_IDLE_PATH});
      content: ' ';
      bottom: 0;
      font-size: 1;
      height: 100%;
      left: 0.15em;
      position: absolute;
      width: 140%;
    }

    ${ACTIVE_CURSOR_CSS}
  `;

  console.log(TERM_CSS);

  return Object.assign({}, config, {
    cursorColor: 'transparent !important',
    termCSS: TERM_CSS,
  });
};

const BUSY_TIMEOUT = 400;
const BUSY_THROTTLE = BUSY_TIMEOUT / 2;

module.exports.decorateTerm = (Term, {React, notify}) => {
  return class extends React.Component {
    constructor (props, context) {
      super(props, context)
      this._onTerminal = this._onTerminal.bind(this)
      this._onCursorChange = this._onCursorChange.bind(this)
      this._updateCursorStatus = this._updateCursorStatus.bind(this)
      this._markBusyThrottled = throttle(this._markBusy.bind(this), BUSY_THROTTLE)
      this._markIdle = this._markIdle.bind(this) }

    _onTerminal (term) {
      if (this.props.onTerminal) {
        this.props.onTerminal(term)
      }

      this._cursor = term.cursorNode_

      this._observer = new MutationObserver(this._onCursorChange)
      this._observer.observe(this._cursor, {
        attributes: true,
        childList: false,
        characterData: false
      })
    }

    _onCursorChange (mutations) {
      const cursorMoved = mutations.some(m => m.attributeName === 'title')
      if (cursorMoved) {
        this._updateCursorStatus()
      }
    }

    _updateCursorStatus () {
      this._markBusyThrottled()

      clearTimeout(this._markingTimer)
      this._markingTimer = setTimeout(() => {
        this._markIdle()
      }, BUSY_TIMEOUT)
    }

    _markBusy () {
      this._cursor.setAttribute('hyper-cursor-moving', true)
    }

    _markIdle () {
      this._cursor.removeAttribute('hyper-cursor-moving')
    }

    render () {
      return React.createElement(Term, Object.assign({}, this.props, {
        onTerminal: this._onTerminal
      }))
    }

    componentWillUnmount () {
      if (this._observer) {
        this._observer.disconnect()
      }
    }
  }
};
