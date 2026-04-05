(function () {
    'use strict';

    function _mergeNamespaces(n, m) {
        m.forEach(function (e) {
            e && typeof e !== 'string' && !Array.isArray(e) && Object.keys(e).forEach(function (k) {
                if (k !== 'default' && !(k in n)) {
                    var d = Object.getOwnPropertyDescriptor(e, k);
                    Object.defineProperty(n, k, d.get ? d : {
                        enumerable: true,
                        get: function () { return e[k]; }
                    });
                }
            });
        });
        return Object.freeze(n);
    }

    const PACKET_TYPES$1 = Object.create(null); // no Map = no polyfill
    PACKET_TYPES$1["open"] = "0";
    PACKET_TYPES$1["close"] = "1";
    PACKET_TYPES$1["ping"] = "2";
    PACKET_TYPES$1["pong"] = "3";
    PACKET_TYPES$1["message"] = "4";
    PACKET_TYPES$1["upgrade"] = "5";
    PACKET_TYPES$1["noop"] = "6";
    const PACKET_TYPES_REVERSE$1 = Object.create(null);
    Object.keys(PACKET_TYPES$1).forEach((key) => {
        PACKET_TYPES_REVERSE$1[PACKET_TYPES$1[key]] = key;
    });
    const ERROR_PACKET$1 = { type: "error", data: "parser error" };

    const withNativeBlob$3 = typeof Blob === "function" ||
        (typeof Blob !== "undefined" &&
            Object.prototype.toString.call(Blob) === "[object BlobConstructor]");
    const withNativeArrayBuffer$5 = typeof ArrayBuffer === "function";
    // ArrayBuffer.isView method is not defined in IE10
    const isView$3 = (obj) => {
        return typeof ArrayBuffer.isView === "function"
            ? ArrayBuffer.isView(obj)
            : obj && obj.buffer instanceof ArrayBuffer;
    };
    const encodePacket$1 = ({ type, data }, supportsBinary, callback) => {
        if (withNativeBlob$3 && data instanceof Blob) {
            if (supportsBinary) {
                return callback(data);
            }
            else {
                return encodeBlobAsBase64$1(data, callback);
            }
        }
        else if (withNativeArrayBuffer$5 &&
            (data instanceof ArrayBuffer || isView$3(data))) {
            if (supportsBinary) {
                return callback(data);
            }
            else {
                return encodeBlobAsBase64$1(new Blob([data]), callback);
            }
        }
        // plain string
        return callback(PACKET_TYPES$1[type] + (data || ""));
    };
    const encodeBlobAsBase64$1 = (data, callback) => {
        const fileReader = new FileReader();
        fileReader.onload = function () {
            const content = fileReader.result.split(",")[1];
            callback("b" + (content || ""));
        };
        return fileReader.readAsDataURL(data);
    };
    function toArray$1(data) {
        if (data instanceof Uint8Array) {
            return data;
        }
        else if (data instanceof ArrayBuffer) {
            return new Uint8Array(data);
        }
        else {
            return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        }
    }
    let TEXT_ENCODER$1;
    function encodePacketToBinary$1(packet, callback) {
        if (withNativeBlob$3 && packet.data instanceof Blob) {
            return packet.data.arrayBuffer().then(toArray$1).then(callback);
        }
        else if (withNativeArrayBuffer$5 &&
            (packet.data instanceof ArrayBuffer || isView$3(packet.data))) {
            return callback(toArray$1(packet.data));
        }
        encodePacket$1(packet, false, (encoded) => {
            if (!TEXT_ENCODER$1) {
                TEXT_ENCODER$1 = new TextEncoder();
            }
            callback(TEXT_ENCODER$1.encode(encoded));
        });
    }

    // imported from https://github.com/socketio/base64-arraybuffer
    const chars$1 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    // Use a lookup table to find the index.
    const lookup$3 = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
    for (let i = 0; i < chars$1.length; i++) {
        lookup$3[chars$1.charCodeAt(i)] = i;
    }
    const decode$3 = (base64) => {
        let bufferLength = base64.length * 0.75, len = base64.length, i, p = 0, encoded1, encoded2, encoded3, encoded4;
        if (base64[base64.length - 1] === '=') {
            bufferLength--;
            if (base64[base64.length - 2] === '=') {
                bufferLength--;
            }
        }
        const arraybuffer = new ArrayBuffer(bufferLength), bytes = new Uint8Array(arraybuffer);
        for (i = 0; i < len; i += 4) {
            encoded1 = lookup$3[base64.charCodeAt(i)];
            encoded2 = lookup$3[base64.charCodeAt(i + 1)];
            encoded3 = lookup$3[base64.charCodeAt(i + 2)];
            encoded4 = lookup$3[base64.charCodeAt(i + 3)];
            bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
            bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
            bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
        }
        return arraybuffer;
    };

    const withNativeArrayBuffer$4 = typeof ArrayBuffer === "function";
    const decodePacket$1 = (encodedPacket, binaryType) => {
        if (typeof encodedPacket !== "string") {
            return {
                type: "message",
                data: mapBinary$1(encodedPacket, binaryType),
            };
        }
        const type = encodedPacket.charAt(0);
        if (type === "b") {
            return {
                type: "message",
                data: decodeBase64Packet$1(encodedPacket.substring(1), binaryType),
            };
        }
        const packetType = PACKET_TYPES_REVERSE$1[type];
        if (!packetType) {
            return ERROR_PACKET$1;
        }
        return encodedPacket.length > 1
            ? {
                type: PACKET_TYPES_REVERSE$1[type],
                data: encodedPacket.substring(1),
            }
            : {
                type: PACKET_TYPES_REVERSE$1[type],
            };
    };
    const decodeBase64Packet$1 = (data, binaryType) => {
        if (withNativeArrayBuffer$4) {
            const decoded = decode$3(data);
            return mapBinary$1(decoded, binaryType);
        }
        else {
            return { base64: true, data }; // fallback for old browsers
        }
    };
    const mapBinary$1 = (data, binaryType) => {
        switch (binaryType) {
            case "blob":
                if (data instanceof Blob) {
                    // from WebSocket + binaryType "blob"
                    return data;
                }
                else {
                    // from HTTP long-polling or WebTransport
                    return new Blob([data]);
                }
            case "arraybuffer":
            default:
                if (data instanceof ArrayBuffer || Object.prototype.toString.call(data) === "[object ArrayBuffer]") {
                // from HTTP long-polling (base64) or WebSocket + binaryType "arraybuffer" (patched for Firefox)
                    return data;
                }
                else {
                    // from WebTransport (Uint8Array)
                    return data.buffer;
                }
        }
    };

    const SEPARATOR$1 = String.fromCharCode(30); // see https://en.wikipedia.org/wiki/Delimiter#ASCII_delimited_text
    const encodePayload$1 = (packets, callback) => {
        // some packets may be added to the array while encoding, so the initial length must be saved
        const length = packets.length;
        const encodedPackets = new Array(length);
        let count = 0;
        packets.forEach((packet, i) => {
            // force base64 encoding for binary packets
            encodePacket$1(packet, false, (encodedPacket) => {
                encodedPackets[i] = encodedPacket;
                if (++count === length) {
                    callback(encodedPackets.join(SEPARATOR$1));
                }
            });
        });
    };
    const decodePayload$1 = (encodedPayload, binaryType) => {
        const encodedPackets = encodedPayload.split(SEPARATOR$1);
        const packets = [];
        for (let i = 0; i < encodedPackets.length; i++) {
            const decodedPacket = decodePacket$1(encodedPackets[i], binaryType);
            packets.push(decodedPacket);
            if (decodedPacket.type === "error") {
                break;
            }
        }
        return packets;
    };
    function createPacketEncoderStream$1() {
        return new TransformStream({
            transform(packet, controller) {
                encodePacketToBinary$1(packet, (encodedPacket) => {
                    const payloadLength = encodedPacket.length;
                    let header;
                    // inspired by the WebSocket format: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#decoding_payload_length
                    if (payloadLength < 126) {
                        header = new Uint8Array(1);
                        new DataView(header.buffer).setUint8(0, payloadLength);
                    }
                    else if (payloadLength < 65536) {
                        header = new Uint8Array(3);
                        const view = new DataView(header.buffer);
                        view.setUint8(0, 126);
                        view.setUint16(1, payloadLength);
                    }
                    else {
                        header = new Uint8Array(9);
                        const view = new DataView(header.buffer);
                        view.setUint8(0, 127);
                        view.setBigUint64(1, BigInt(payloadLength));
                    }
                    // first bit indicates whether the payload is plain text (0) or binary (1)
                    if (packet.data && typeof packet.data !== "string") {
                        header[0] |= 0x80;
                    }
                    controller.enqueue(header);
                    controller.enqueue(encodedPacket);
                });
            },
        });
    }
    let TEXT_DECODER$1;
    function totalLength$1(chunks) {
        return chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    }
    function concatChunks$1(chunks, size) {
        if (chunks[0].length === size) {
            return chunks.shift();
        }
        const buffer = new Uint8Array(size);
        let j = 0;
        for (let i = 0; i < size; i++) {
            buffer[i] = chunks[0][j++];
            if (j === chunks[0].length) {
                chunks.shift();
                j = 0;
            }
        }
        if (chunks.length && j < chunks[0].length) {
            chunks[0] = chunks[0].slice(j);
        }
        return buffer;
    }
    function createPacketDecoderStream$1(maxPayload, binaryType) {
        if (!TEXT_DECODER$1) {
            TEXT_DECODER$1 = new TextDecoder();
        }
        const chunks = [];
        let state = 0 /* State.READ_HEADER */;
        let expectedLength = -1;
        let isBinary = false;
        return new TransformStream({
            transform(chunk, controller) {
                chunks.push(chunk);
                while (true) {
                    if (state === 0 /* State.READ_HEADER */) {
                        if (totalLength$1(chunks) < 1) {
                            break;
                        }
                        const header = concatChunks$1(chunks, 1);
                        isBinary = (header[0] & 0x80) === 0x80;
                        expectedLength = header[0] & 0x7f;
                        if (expectedLength < 126) {
                            state = 3 /* State.READ_PAYLOAD */;
                        }
                        else if (expectedLength === 126) {
                            state = 1 /* State.READ_EXTENDED_LENGTH_16 */;
                        }
                        else {
                            state = 2 /* State.READ_EXTENDED_LENGTH_64 */;
                        }
                    }
                    else if (state === 1 /* State.READ_EXTENDED_LENGTH_16 */) {
                        if (totalLength$1(chunks) < 2) {
                            break;
                        }
                        const headerArray = concatChunks$1(chunks, 2);
                        expectedLength = new DataView(headerArray.buffer, headerArray.byteOffset, headerArray.length).getUint16(0);
                        state = 3 /* State.READ_PAYLOAD */;
                    }
                    else if (state === 2 /* State.READ_EXTENDED_LENGTH_64 */) {
                        if (totalLength$1(chunks) < 8) {
                            break;
                        }
                        const headerArray = concatChunks$1(chunks, 8);
                        const view = new DataView(headerArray.buffer, headerArray.byteOffset, headerArray.length);
                        const n = view.getUint32(0);
                        if (n > Math.pow(2, 53 - 32) - 1) {
                            // the maximum safe integer in JavaScript is 2^53 - 1
                            controller.enqueue(ERROR_PACKET$1);
                            break;
                        }
                        expectedLength = n * Math.pow(2, 32) + view.getUint32(4);
                        state = 3 /* State.READ_PAYLOAD */;
                    }
                    else {
                        if (totalLength$1(chunks) < expectedLength) {
                            break;
                        }
                        const data = concatChunks$1(chunks, expectedLength);
                        controller.enqueue(decodePacket$1(isBinary ? data : TEXT_DECODER$1.decode(data), binaryType));
                        state = 0 /* State.READ_HEADER */;
                    }
                    if (expectedLength === 0 || expectedLength > maxPayload) {
                        controller.enqueue(ERROR_PACKET$1);
                        break;
                    }
                }
            },
        });
    }
    const protocol$1 = 4;

    /**
     * Initialize a new `Emitter`.
     *
     * @api public
     */

    function Emitter$1(obj) {
      if (obj) return mixin$1(obj);
    }

    /**
     * Mixin the emitter properties.
     *
     * @param {Object} obj
     * @return {Object}
     * @api private
     */

    function mixin$1(obj) {
      for (var key in Emitter$1.prototype) {
        obj[key] = Emitter$1.prototype[key];
      }
      return obj;
    }

    /**
     * Listen on the given `event` with `fn`.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter$1.prototype.on =
    Emitter$1.prototype.addEventListener = function(event, fn){
      this._callbacks = this._callbacks || {};
      (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
        .push(fn);
      return this;
    };

    /**
     * Adds an `event` listener that will be invoked a single
     * time then automatically removed.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter$1.prototype.once = function(event, fn){
      function on() {
        this.off(event, on);
        fn.apply(this, arguments);
      }

      on.fn = fn;
      this.on(event, on);
      return this;
    };

    /**
     * Remove the given callback for `event` or all
     * registered callbacks.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter$1.prototype.off =
    Emitter$1.prototype.removeListener =
    Emitter$1.prototype.removeAllListeners =
    Emitter$1.prototype.removeEventListener = function(event, fn){
      this._callbacks = this._callbacks || {};

      // all
      if (0 == arguments.length) {
        this._callbacks = {};
        return this;
      }

      // specific event
      var callbacks = this._callbacks['$' + event];
      if (!callbacks) return this;

      // remove all handlers
      if (1 == arguments.length) {
        delete this._callbacks['$' + event];
        return this;
      }

      // remove specific handler
      var cb;
      for (var i = 0; i < callbacks.length; i++) {
        cb = callbacks[i];
        if (cb === fn || cb.fn === fn) {
          callbacks.splice(i, 1);
          break;
        }
      }

      // Remove event specific arrays for event types that no
      // one is subscribed for to avoid memory leak.
      if (callbacks.length === 0) {
        delete this._callbacks['$' + event];
      }

      return this;
    };

    /**
     * Emit `event` with the given args.
     *
     * @param {String} event
     * @param {Mixed} ...
     * @return {Emitter}
     */

    Emitter$1.prototype.emit = function(event){
      this._callbacks = this._callbacks || {};

      var args = new Array(arguments.length - 1)
        , callbacks = this._callbacks['$' + event];

      for (var i = 1; i < arguments.length; i++) {
        args[i - 1] = arguments[i];
      }

      if (callbacks) {
        callbacks = callbacks.slice(0);
        for (var i = 0, len = callbacks.length; i < len; ++i) {
          callbacks[i].apply(this, args);
        }
      }

      return this;
    };

    // alias used for reserved events (protected method)
    Emitter$1.prototype.emitReserved = Emitter$1.prototype.emit;

    /**
     * Return array of callbacks for `event`.
     *
     * @param {String} event
     * @return {Array}
     * @api public
     */

    Emitter$1.prototype.listeners = function(event){
      this._callbacks = this._callbacks || {};
      return this._callbacks['$' + event] || [];
    };

    /**
     * Check if this emitter has `event` handlers.
     *
     * @param {String} event
     * @return {Boolean}
     * @api public
     */

    Emitter$1.prototype.hasListeners = function(event){
      return !! this.listeners(event).length;
    };

    const nextTick$1 = (() => {
        const isPromiseAvailable = typeof Promise === "function" && typeof Promise.resolve === "function";
        if (isPromiseAvailable) {
            return (cb) => Promise.resolve().then(cb);
        }
        else {
            return (cb, setTimeoutFn) => setTimeoutFn(cb, 0);
        }
    })();
    const globalThisShim$1 = (() => {
        if (typeof self !== "undefined") {
            return self;
        }
        else if (typeof window !== "undefined") {
            return window;
        }
        else {
            return Function("return this")();
        }
    })();
    const defaultBinaryType$1 = "arraybuffer";
    function createCookieJar$1() { }

    function pick$1(obj, ...attr) {
        return attr.reduce((acc, k) => {
            if (obj.hasOwnProperty(k)) {
                acc[k] = obj[k];
            }
            return acc;
        }, {});
    }
    // Keep a reference to the real timeout functions so they can be used when overridden
    const NATIVE_SET_TIMEOUT$1 = globalThisShim$1.setTimeout;
    const NATIVE_CLEAR_TIMEOUT$1 = globalThisShim$1.clearTimeout;
    function installTimerFunctions$1(obj, opts) {
        if (opts.useNativeTimers) {
            obj.setTimeoutFn = NATIVE_SET_TIMEOUT$1.bind(globalThisShim$1);
            obj.clearTimeoutFn = NATIVE_CLEAR_TIMEOUT$1.bind(globalThisShim$1);
        }
        else {
            obj.setTimeoutFn = globalThisShim$1.setTimeout.bind(globalThisShim$1);
            obj.clearTimeoutFn = globalThisShim$1.clearTimeout.bind(globalThisShim$1);
        }
    }
    // base64 encoded buffers are about 33% bigger (https://en.wikipedia.org/wiki/Base64)
    const BASE64_OVERHEAD$1 = 1.33;
    // we could also have used `new Blob([obj]).size`, but it isn't supported in IE9
    function byteLength$1(obj) {
        if (typeof obj === "string") {
            return utf8Length$1(obj);
        }
        // arraybuffer or blob
        return Math.ceil((obj.byteLength || obj.size) * BASE64_OVERHEAD$1);
    }
    function utf8Length$1(str) {
        let c = 0, length = 0;
        for (let i = 0, l = str.length; i < l; i++) {
            c = str.charCodeAt(i);
            if (c < 0x80) {
                length += 1;
            }
            else if (c < 0x800) {
                length += 2;
            }
            else if (c < 0xd800 || c >= 0xe000) {
                length += 3;
            }
            else {
                i++;
                length += 4;
            }
        }
        return length;
    }
    /**
     * Generates a random 8-characters string.
     */
    function randomString$1() {
        return (Date.now().toString(36).substring(3) +
            Math.random().toString(36).substring(2, 5));
    }

    // imported from https://github.com/galkn/querystring
    /**
     * Compiles a querystring
     * Returns string representation of the object
     *
     * @param {Object}
     * @api private
     */
    function encode$1(obj) {
        let str = '';
        for (let i in obj) {
            if (obj.hasOwnProperty(i)) {
                if (str.length)
                    str += '&';
                str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
            }
        }
        return str;
    }
    /**
     * Parses a simple querystring into an object
     *
     * @param {String} qs
     * @api private
     */
    function decode$2(qs) {
        let qry = {};
        let pairs = qs.split('&');
        for (let i = 0, l = pairs.length; i < l; i++) {
            let pair = pairs[i].split('=');
            qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
        }
        return qry;
    }

    let TransportError$1 = class TransportError extends Error {
        constructor(reason, description, context) {
            super(reason);
            this.description = description;
            this.context = context;
            this.type = "TransportError";
        }
    };
    let Transport$1 = class Transport extends Emitter$1 {
        /**
         * Transport abstract constructor.
         *
         * @param {Object} opts - options
         * @protected
         */
        constructor(opts) {
            super();
            this.writable = false;
            installTimerFunctions$1(this, opts);
            this.opts = opts;
            this.query = opts.query;
            this.socket = opts.socket;
            this.supportsBinary = !opts.forceBase64;
        }
        /**
         * Emits an error.
         *
         * @param {String} reason
         * @param description
         * @param context - the error context
         * @return {Transport} for chaining
         * @protected
         */
        onError(reason, description, context) {
            super.emitReserved("error", new TransportError$1(reason, description, context));
            return this;
        }
        /**
         * Opens the transport.
         */
        open() {
            this.readyState = "opening";
            this.doOpen();
            return this;
        }
        /**
         * Closes the transport.
         */
        close() {
            if (this.readyState === "opening" || this.readyState === "open") {
                this.doClose();
                this.onClose();
            }
            return this;
        }
        /**
         * Sends multiple packets.
         *
         * @param {Array} packets
         */
        send(packets) {
            if (this.readyState === "open") {
                this.write(packets);
            }
        }
        /**
         * Called upon open
         *
         * @protected
         */
        onOpen() {
            this.readyState = "open";
            this.writable = true;
            super.emitReserved("open");
        }
        /**
         * Called with data.
         *
         * @param {String} data
         * @protected
         */
        onData(data) {
            const packet = decodePacket$1(data, this.socket.binaryType);
            this.onPacket(packet);
        }
        /**
         * Called with a decoded packet.
         *
         * @protected
         */
        onPacket(packet) {
            super.emitReserved("packet", packet);
        }
        /**
         * Called upon close.
         *
         * @protected
         */
        onClose(details) {
            this.readyState = "closed";
            super.emitReserved("close", details);
        }
        /**
         * Pauses the transport, in order not to lose packets during an upgrade.
         *
         * @param onPause
         */
        pause(onPause) { }
        createUri(schema, query = {}) {
            return (schema +
                "://" +
                this._hostname() +
                this._port() +
                this.opts.path +
                this._query(query));
        }
        _hostname() {
            const hostname = this.opts.hostname;
            return hostname.indexOf(":") === -1 ? hostname : "[" + hostname + "]";
        }
        _port() {
            if (this.opts.port &&
                ((this.opts.secure && Number(this.opts.port) !== 443) ||
                    (!this.opts.secure && Number(this.opts.port) !== 80))) {
                return ":" + this.opts.port;
            }
            else {
                return "";
            }
        }
        _query(query) {
            const encodedQuery = encode$1(query);
            return encodedQuery.length ? "?" + encodedQuery : "";
        }
    };

    let Polling$1 = class Polling extends Transport$1 {
        constructor() {
            super(...arguments);
            this._polling = false;
        }
        get name() {
            return "polling";
        }
        /**
         * Opens the socket (triggers polling). We write a PING message to determine
         * when the transport is open.
         *
         * @protected
         */
        doOpen() {
            this._poll();
        }
        /**
         * Pauses polling.
         *
         * @param {Function} onPause - callback upon buffers are flushed and transport is paused
         * @package
         */
        pause(onPause) {
            this.readyState = "pausing";
            const pause = () => {
                this.readyState = "paused";
                onPause();
            };
            if (this._polling || !this.writable) {
                let total = 0;
                if (this._polling) {
                    total++;
                    this.once("pollComplete", function () {
                        --total || pause();
                    });
                }
                if (!this.writable) {
                    total++;
                    this.once("drain", function () {
                        --total || pause();
                    });
                }
            }
            else {
                pause();
            }
        }
        /**
         * Starts polling cycle.
         *
         * @private
         */
        _poll() {
            this._polling = true;
            this.doPoll();
            this.emitReserved("poll");
        }
        /**
         * Overloads onData to detect payloads.
         *
         * @protected
         */
        onData(data) {
            const callback = (packet) => {
                // if its the first message we consider the transport open
                if ("opening" === this.readyState && packet.type === "open") {
                    this.onOpen();
                }
                // if its a close packet, we close the ongoing requests
                if ("close" === packet.type) {
                    this.onClose({ description: "transport closed by the server" });
                    return false;
                }
                // otherwise bypass onData and handle the message
                this.onPacket(packet);
            };
            // decode payload
            decodePayload$1(data, this.socket.binaryType).forEach(callback);
            // if an event did not trigger closing
            if ("closed" !== this.readyState) {
                // if we got data we're not polling
                this._polling = false;
                this.emitReserved("pollComplete");
                if ("open" === this.readyState) {
                    this._poll();
                }
            }
        }
        /**
         * For polling, send a close packet.
         *
         * @protected
         */
        doClose() {
            const close = () => {
                this.write([{ type: "close" }]);
            };
            if ("open" === this.readyState) {
                close();
            }
            else {
                // in case we're trying to close while
                // handshaking is in progress (GH-164)
                this.once("open", close);
            }
        }
        /**
         * Writes a packets payload.
         *
         * @param {Array} packets - data packets
         * @protected
         */
        write(packets) {
            this.writable = false;
            encodePayload$1(packets, (data) => {
                this.doWrite(data, () => {
                    this.writable = true;
                    this.emitReserved("drain");
                });
            });
        }
        /**
         * Generates uri for connection.
         *
         * @private
         */
        uri() {
            const schema = this.opts.secure ? "https" : "http";
            const query = this.query || {};
            // cache busting is forced
            if (false !== this.opts.timestampRequests) {
                query[this.opts.timestampParam] = randomString$1();
            }
            if (!this.supportsBinary && !query.sid) {
                query.b64 = 1;
            }
            return this.createUri(schema, query);
        }
    };

    // imported from https://github.com/component/has-cors
    let value$1 = false;
    try {
        value$1 = typeof XMLHttpRequest !== 'undefined' &&
            'withCredentials' in new XMLHttpRequest();
    }
    catch (err) {
        // if XMLHttp support is disabled in IE then it will throw
        // when trying to create
    }
    const hasCORS$1 = value$1;

    function empty$1() { }
    let BaseXHR$1 = class BaseXHR extends Polling$1 {
        /**
         * XHR Polling constructor.
         *
         * @param {Object} opts
         * @package
         */
        constructor(opts) {
            super(opts);
            if (typeof location !== "undefined") {
                const isSSL = "https:" === location.protocol;
                let port = location.port;
                // some user agents have empty `location.port`
                if (!port) {
                    port = isSSL ? "443" : "80";
                }
                this.xd =
                    (typeof location !== "undefined" &&
                        opts.hostname !== location.hostname) ||
                        port !== opts.port;
            }
        }
        /**
         * Sends data.
         *
         * @param {String} data to send.
         * @param {Function} called upon flush.
         * @private
         */
        doWrite(data, fn) {
            const req = this.request({
                method: "POST",
                data: data,
            });
            req.on("success", fn);
            req.on("error", (xhrStatus, context) => {
                this.onError("xhr post error", xhrStatus, context);
            });
        }
        /**
         * Starts a poll cycle.
         *
         * @private
         */
        doPoll() {
            const req = this.request();
            req.on("data", this.onData.bind(this));
            req.on("error", (xhrStatus, context) => {
                this.onError("xhr poll error", xhrStatus, context);
            });
            this.pollXhr = req;
        }
    };
    let Request$1 = class Request extends Emitter$1 {
        /**
         * Request constructor
         *
         * @param {Object} options
         * @package
         */
        constructor(createRequest, uri, opts) {
            super();
            this.createRequest = createRequest;
            installTimerFunctions$1(this, opts);
            this._opts = opts;
            this._method = opts.method || "GET";
            this._uri = uri;
            this._data = undefined !== opts.data ? opts.data : null;
            this._create();
        }
        /**
         * Creates the XHR object and sends the request.
         *
         * @private
         */
        _create() {
            var _a;
            const opts = pick$1(this._opts, "agent", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "autoUnref");
            opts.xdomain = !!this._opts.xd;
            const xhr = (this._xhr = this.createRequest(opts));
            try {
                xhr.open(this._method, this._uri, true);
                try {
                    if (this._opts.extraHeaders) {
                        // @ts-ignore
                        xhr.setDisableHeaderCheck && xhr.setDisableHeaderCheck(true);
                        for (let i in this._opts.extraHeaders) {
                            if (this._opts.extraHeaders.hasOwnProperty(i)) {
                                xhr.setRequestHeader(i, this._opts.extraHeaders[i]);
                            }
                        }
                    }
                }
                catch (e) { }
                if ("POST" === this._method) {
                    try {
                        xhr.setRequestHeader("Content-type", "text/plain;charset=UTF-8");
                    }
                    catch (e) { }
                }
                try {
                    xhr.setRequestHeader("Accept", "*/*");
                }
                catch (e) { }
                (_a = this._opts.cookieJar) === null || _a === void 0 ? void 0 : _a.addCookies(xhr);
                // ie6 check
                if ("withCredentials" in xhr) {
                    xhr.withCredentials = this._opts.withCredentials;
                }
                if (this._opts.requestTimeout) {
                    xhr.timeout = this._opts.requestTimeout;
                }
                xhr.onreadystatechange = () => {
                    var _a;
                    if (xhr.readyState === 3) {
                        (_a = this._opts.cookieJar) === null || _a === void 0 ? void 0 : _a.parseCookies(
                        // @ts-ignore
                        xhr.getResponseHeader("set-cookie"));
                    }
                    if (4 !== xhr.readyState)
                        return;
                    if (200 === xhr.status || 1223 === xhr.status) {
                        this._onLoad();
                    }
                    else {
                        // make sure the `error` event handler that's user-set
                        // does not throw in the same tick and gets caught here
                        this.setTimeoutFn(() => {
                            this._onError(typeof xhr.status === "number" ? xhr.status : 0);
                        }, 0);
                    }
                };
                xhr.send(this._data);
            }
            catch (e) {
                // Need to defer since .create() is called directly from the constructor
                // and thus the 'error' event can only be only bound *after* this exception
                // occurs.  Therefore, also, we cannot throw here at all.
                this.setTimeoutFn(() => {
                    this._onError(e);
                }, 0);
                return;
            }
            if (typeof document !== "undefined") {
                this._index = Request.requestsCount++;
                Request.requests[this._index] = this;
            }
        }
        /**
         * Called upon error.
         *
         * @private
         */
        _onError(err) {
            this.emitReserved("error", err, this._xhr);
            this._cleanup(true);
        }
        /**
         * Cleans up house.
         *
         * @private
         */
        _cleanup(fromError) {
            if ("undefined" === typeof this._xhr || null === this._xhr) {
                return;
            }
            this._xhr.onreadystatechange = empty$1;
            if (fromError) {
                try {
                    this._xhr.abort();
                }
                catch (e) { }
            }
            if (typeof document !== "undefined") {
                delete Request.requests[this._index];
            }
            this._xhr = null;
        }
        /**
         * Called upon load.
         *
         * @private
         */
        _onLoad() {
            const data = this._xhr.responseText;
            if (data !== null) {
                this.emitReserved("data", data);
                this.emitReserved("success");
                this._cleanup();
            }
        }
        /**
         * Aborts the request.
         *
         * @package
         */
        abort() {
            this._cleanup();
        }
    };
    Request$1.requestsCount = 0;
    Request$1.requests = {};
    /**
     * Aborts pending requests when unloading the window. This is needed to prevent
     * memory leaks (e.g. when using IE) and to ensure that no spurious error is
     * emitted.
     */
    if (typeof document !== "undefined") {
        // @ts-ignore
        if (typeof attachEvent === "function") {
            // @ts-ignore
            attachEvent("onunload", unloadHandler$1);
        }
        else if (typeof addEventListener === "function") {
            const terminationEvent = "onpagehide" in globalThisShim$1 ? "pagehide" : "unload";
            addEventListener(terminationEvent, unloadHandler$1, false);
        }
    }
    function unloadHandler$1() {
        for (let i in Request$1.requests) {
            if (Request$1.requests.hasOwnProperty(i)) {
                Request$1.requests[i].abort();
            }
        }
    }
    const hasXHR2$1 = (function () {
        const xhr = newRequest$1({
            xdomain: false,
        });
        return xhr && xhr.responseType !== null;
    })();
    /**
     * HTTP long-polling based on the built-in `XMLHttpRequest` object.
     *
     * Usage: browser
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
     */
    let XHR$1 = class XHR extends BaseXHR$1 {
        constructor(opts) {
            super(opts);
            const forceBase64 = opts && opts.forceBase64;
            this.supportsBinary = hasXHR2$1 && !forceBase64;
        }
        request(opts = {}) {
            Object.assign(opts, { xd: this.xd }, this.opts);
            return new Request$1(newRequest$1, this.uri(), opts);
        }
    };
    function newRequest$1(opts) {
        const xdomain = opts.xdomain;
        // XMLHttpRequest can be disabled on IE
        try {
            if ("undefined" !== typeof XMLHttpRequest && (!xdomain || hasCORS$1)) {
                return new XMLHttpRequest();
            }
        }
        catch (e) { }
        if (!xdomain) {
            try {
                return new globalThisShim$1[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP");
            }
            catch (e) { }
        }
    }

    // detect ReactNative environment
    const isReactNative$1 = typeof navigator !== "undefined" &&
        typeof navigator.product === "string" &&
        navigator.product.toLowerCase() === "reactnative";
    let BaseWS$1 = class BaseWS extends Transport$1 {
        get name() {
            return "websocket";
        }
        doOpen() {
            const uri = this.uri();
            const protocols = this.opts.protocols;
            // React Native only supports the 'headers' option, and will print a warning if anything else is passed
            const opts = isReactNative$1
                ? {}
                : pick$1(this.opts, "agent", "perMessageDeflate", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "localAddress", "protocolVersion", "origin", "maxPayload", "family", "checkServerIdentity");
            if (this.opts.extraHeaders) {
                opts.headers = this.opts.extraHeaders;
            }
            try {
                this.ws = this.createSocket(uri, protocols, opts);
            }
            catch (err) {
                return this.emitReserved("error", err);
            }
            this.ws.binaryType = this.socket.binaryType;
            this.addEventListeners();
        }
        /**
         * Adds event listeners to the socket
         *
         * @private
         */
        addEventListeners() {
            this.ws.onopen = () => {
                if (this.opts.autoUnref) {
                    this.ws._socket.unref();
                }
                this.onOpen();
            };
            this.ws.onclose = (closeEvent) => this.onClose({
                description: "websocket connection closed",
                context: closeEvent,
            });
            this.ws.onmessage = (ev) => this.onData(ev.data);
            this.ws.onerror = (e) => this.onError("websocket error", e);
        }
        write(packets) {
            this.writable = false;
            // encodePacket efficient as it uses WS framing
            // no need for encodePayload
            for (let i = 0; i < packets.length; i++) {
                const packet = packets[i];
                const lastPacket = i === packets.length - 1;
                encodePacket$1(packet, this.supportsBinary, (data) => {
                    // Sometimes the websocket has already been closed but the browser didn't
                    // have a chance of informing us about it yet, in that case send will
                    // throw an error
                    try {
                        this.doWrite(packet, data);
                    }
                    catch (e) {
                    }
                    if (lastPacket) {
                        // fake drain
                        // defer to next tick to allow Socket to clear writeBuffer
                        nextTick$1(() => {
                            this.writable = true;
                            this.emitReserved("drain");
                        }, this.setTimeoutFn);
                    }
                });
            }
        }
        doClose() {
            if (typeof this.ws !== "undefined") {
                this.ws.onerror = () => { };
                this.ws.close();
                this.ws = null;
            }
        }
        /**
         * Generates uri for connection.
         *
         * @private
         */
        uri() {
            const schema = this.opts.secure ? "wss" : "ws";
            const query = this.query || {};
            // append timestamp to URI
            if (this.opts.timestampRequests) {
                query[this.opts.timestampParam] = randomString$1();
            }
            // communicate binary support capabilities
            if (!this.supportsBinary) {
                query.b64 = 1;
            }
            return this.createUri(schema, query);
        }
    };
    const WebSocketCtor$1 = globalThisShim$1.WebSocket || globalThisShim$1.MozWebSocket;
    /**
     * WebSocket transport based on the built-in `WebSocket` object.
     *
     * Usage: browser, Node.js (since v21), Deno, Bun
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
     * @see https://caniuse.com/mdn-api_websocket
     * @see https://nodejs.org/api/globals.html#websocket
     */
    let WS$1 = class WS extends BaseWS$1 {
        createSocket(uri, protocols, opts) {
            return !isReactNative$1
                ? protocols
                    ? new WebSocketCtor$1(uri, protocols)
                    : new WebSocketCtor$1(uri)
                : new WebSocketCtor$1(uri, protocols, opts);
        }
        doWrite(_packet, data) {
            this.ws.send(data);
        }
    };

    /**
     * WebTransport transport based on the built-in `WebTransport` object.
     *
     * Usage: browser, Node.js (with the `@fails-components/webtransport` package)
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WebTransport
     * @see https://caniuse.com/webtransport
     */
    let WT$1 = class WT extends Transport$1 {
        get name() {
            return "webtransport";
        }
        doOpen() {
            try {
                // @ts-ignore
                this._transport = new WebTransport(this.createUri("https"), this.opts.transportOptions[this.name]);
            }
            catch (err) {
                return this.emitReserved("error", err);
            }
            this._transport.closed
                .then(() => {
                this.onClose();
            })
                .catch((err) => {
                this.onError("webtransport error", err);
            });
            // note: we could have used async/await, but that would require some additional polyfills
            this._transport.ready.then(() => {
                this._transport.createBidirectionalStream().then((stream) => {
                    const decoderStream = createPacketDecoderStream$1(Number.MAX_SAFE_INTEGER, this.socket.binaryType);
                    const reader = stream.readable.pipeThrough(decoderStream).getReader();
                    const encoderStream = createPacketEncoderStream$1();
                    encoderStream.readable.pipeTo(stream.writable);
                    this._writer = encoderStream.writable.getWriter();
                    const read = () => {
                        reader
                            .read()
                            .then(({ done, value }) => {
                            if (done) {
                                return;
                            }
                            this.onPacket(value);
                            read();
                        })
                            .catch((err) => {
                        });
                    };
                    read();
                    const packet = { type: "open" };
                    if (this.query.sid) {
                        packet.data = `{"sid":"${this.query.sid}"}`;
                    }
                    this._writer.write(packet).then(() => this.onOpen());
                });
            });
        }
        write(packets) {
            this.writable = false;
            for (let i = 0; i < packets.length; i++) {
                const packet = packets[i];
                const lastPacket = i === packets.length - 1;
                this._writer.write(packet).then(() => {
                    if (lastPacket) {
                        nextTick$1(() => {
                            this.writable = true;
                            this.emitReserved("drain");
                        }, this.setTimeoutFn);
                    }
                });
            }
        }
        doClose() {
            var _a;
            (_a = this._transport) === null || _a === void 0 ? void 0 : _a.close();
        }
    };

    const transports$1 = {
        websocket: WS$1,
        webtransport: WT$1,
        polling: XHR$1,
    };

    // imported from https://github.com/galkn/parseuri
    /**
     * Parses a URI
     *
     * Note: we could also have used the built-in URL object, but it isn't supported on all platforms.
     *
     * See:
     * - https://developer.mozilla.org/en-US/docs/Web/API/URL
     * - https://caniuse.com/url
     * - https://www.rfc-editor.org/rfc/rfc3986#appendix-B
     *
     * History of the parse() method:
     * - first commit: https://github.com/socketio/socket.io-client/commit/4ee1d5d94b3906a9c052b459f1a818b15f38f91c
     * - export into its own module: https://github.com/socketio/engine.io-client/commit/de2c561e4564efeb78f1bdb1ba39ef81b2822cb3
     * - reimport: https://github.com/socketio/engine.io-client/commit/df32277c3f6d622eec5ed09f493cae3f3391d242
     *
     * @author Steven Levithan <stevenlevithan.com> (MIT license)
     * @api private
     */
    const re$1 = /^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;
    const parts$1 = [
        'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
    ];
    function parse$1(str) {
        if (str.length > 8000) {
            throw "URI too long";
        }
        const src = str, b = str.indexOf('['), e = str.indexOf(']');
        if (b != -1 && e != -1) {
            str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ';') + str.substring(e, str.length);
        }
        let m = re$1.exec(str || ''), uri = {}, i = 14;
        while (i--) {
            uri[parts$1[i]] = m[i] || '';
        }
        if (b != -1 && e != -1) {
            uri.source = src;
            uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ':');
            uri.authority = uri.authority.replace('[', '').replace(']', '').replace(/;/g, ':');
            uri.ipv6uri = true;
        }
        uri.pathNames = pathNames$1(uri, uri['path']);
        uri.queryKey = queryKey$1(uri, uri['query']);
        return uri;
    }
    function pathNames$1(obj, path) {
        const regx = /\/{2,9}/g, names = path.replace(regx, "/").split("/");
        if (path.slice(0, 1) == '/' || path.length === 0) {
            names.splice(0, 1);
        }
        if (path.slice(-1) == '/') {
            names.splice(names.length - 1, 1);
        }
        return names;
    }
    function queryKey$1(uri, query) {
        const data = {};
        query.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function ($0, $1, $2) {
            if ($1) {
                data[$1] = $2;
            }
        });
        return data;
    }

    const withEventListeners$1 = typeof addEventListener === "function" &&
        typeof removeEventListener === "function";
    const OFFLINE_EVENT_LISTENERS$1 = [];
    if (withEventListeners$1) {
        // within a ServiceWorker, any event handler for the 'offline' event must be added on the initial evaluation of the
        // script, so we create one single event listener here which will forward the event to the socket instances
        addEventListener("offline", () => {
            OFFLINE_EVENT_LISTENERS$1.forEach((listener) => listener());
        }, false);
    }
    /**
     * This class provides a WebSocket-like interface to connect to an Engine.IO server. The connection will be established
     * with one of the available low-level transports, like HTTP long-polling, WebSocket or WebTransport.
     *
     * This class comes without upgrade mechanism, which means that it will keep the first low-level transport that
     * successfully establishes the connection.
     *
     * In order to allow tree-shaking, there are no transports included, that's why the `transports` option is mandatory.
     *
     * @example
     * import { SocketWithoutUpgrade, WebSocket } from "engine.io-client";
     *
     * const socket = new SocketWithoutUpgrade({
     *   transports: [WebSocket]
     * });
     *
     * socket.on("open", () => {
     *   socket.send("hello");
     * });
     *
     * @see SocketWithUpgrade
     * @see Socket
     */
    let SocketWithoutUpgrade$1 = class SocketWithoutUpgrade extends Emitter$1 {
        /**
         * Socket constructor.
         *
         * @param {String|Object} uri - uri or options
         * @param {Object} opts - options
         */
        constructor(uri, opts) {
            super();
            this.binaryType = defaultBinaryType$1;
            this.writeBuffer = [];
            this._prevBufferLen = 0;
            this._pingInterval = -1;
            this._pingTimeout = -1;
            this._maxPayload = -1;
            /**
             * The expiration timestamp of the {@link _pingTimeoutTimer} object is tracked, in case the timer is throttled and the
             * callback is not fired on time. This can happen for example when a laptop is suspended or when a phone is locked.
             */
            this._pingTimeoutTime = Infinity;
            if (uri && "object" === typeof uri) {
                opts = uri;
                uri = null;
            }
            if (uri) {
                const parsedUri = parse$1(uri);
                opts.hostname = parsedUri.host;
                opts.secure =
                    parsedUri.protocol === "https" || parsedUri.protocol === "wss";
                opts.port = parsedUri.port;
                if (parsedUri.query)
                    opts.query = parsedUri.query;
            }
            else if (opts.host) {
                opts.hostname = parse$1(opts.host).host;
            }
            installTimerFunctions$1(this, opts);
            this.secure =
                null != opts.secure
                    ? opts.secure
                    : typeof location !== "undefined" && "https:" === location.protocol;
            if (opts.hostname && !opts.port) {
                // if no port is specified manually, use the protocol default
                opts.port = this.secure ? "443" : "80";
            }
            this.hostname =
                opts.hostname ||
                    (typeof location !== "undefined" ? location.hostname : "localhost");
            this.port =
                opts.port ||
                    (typeof location !== "undefined" && location.port
                        ? location.port
                        : this.secure
                            ? "443"
                            : "80");
            this.transports = [];
            this._transportsByName = {};
            opts.transports.forEach((t) => {
                const transportName = t.prototype.name;
                this.transports.push(transportName);
                this._transportsByName[transportName] = t;
            });
            this.opts = Object.assign({
                path: "/engine.io",
                agent: false,
                withCredentials: false,
                upgrade: true,
                timestampParam: "t",
                rememberUpgrade: false,
                addTrailingSlash: true,
                rejectUnauthorized: true,
                perMessageDeflate: {
                    threshold: 1024,
                },
                transportOptions: {},
                closeOnBeforeunload: false,
            }, opts);
            this.opts.path =
                this.opts.path.replace(/\/$/, "") +
                    (this.opts.addTrailingSlash ? "/" : "");
            if (typeof this.opts.query === "string") {
                this.opts.query = decode$2(this.opts.query);
            }
            if (withEventListeners$1) {
                if (this.opts.closeOnBeforeunload) {
                    // Firefox closes the connection when the "beforeunload" event is emitted but not Chrome. This event listener
                    // ensures every browser behaves the same (no "disconnect" event at the Socket.IO level when the page is
                    // closed/reloaded)
                    this._beforeunloadEventListener = () => {
                        if (this.transport) {
                            // silently close the transport
                            this.transport.removeAllListeners();
                            this.transport.close();
                        }
                    };
                    addEventListener("beforeunload", this._beforeunloadEventListener, false);
                }
                if (this.hostname !== "localhost") {
                    this._offlineEventListener = () => {
                        this._onClose("transport close", {
                            description: "network connection lost",
                        });
                    };
                    OFFLINE_EVENT_LISTENERS$1.push(this._offlineEventListener);
                }
            }
            if (this.opts.withCredentials) {
                this._cookieJar = createCookieJar$1();
            }
            this._open();
        }
        /**
         * Creates transport of the given type.
         *
         * @param {String} name - transport name
         * @return {Transport}
         * @private
         */
        createTransport(name) {
            const query = Object.assign({}, this.opts.query);
            // append engine.io protocol identifier
            query.EIO = protocol$1;
            // transport name
            query.transport = name;
            // session id if we already have one
            if (this.id)
                query.sid = this.id;
            const opts = Object.assign({}, this.opts, {
                query,
                socket: this,
                hostname: this.hostname,
                secure: this.secure,
                port: this.port,
            }, this.opts.transportOptions[name]);
            return new this._transportsByName[name](opts);
        }
        /**
         * Initializes transport to use and starts probe.
         *
         * @private
         */
        _open() {
            if (this.transports.length === 0) {
                // Emit error on next tick so it can be listened to
                this.setTimeoutFn(() => {
                    this.emitReserved("error", "No transports available");
                }, 0);
                return;
            }
            const transportName = this.opts.rememberUpgrade &&
                SocketWithoutUpgrade.priorWebsocketSuccess &&
                this.transports.indexOf("websocket") !== -1
                ? "websocket"
                : this.transports[0];
            this.readyState = "opening";
            const transport = this.createTransport(transportName);
            transport.open();
            this.setTransport(transport);
        }
        /**
         * Sets the current transport. Disables the existing one (if any).
         *
         * @private
         */
        setTransport(transport) {
            if (this.transport) {
                this.transport.removeAllListeners();
            }
            // set up transport
            this.transport = transport;
            // set up transport listeners
            transport
                .on("drain", this._onDrain.bind(this))
                .on("packet", this._onPacket.bind(this))
                .on("error", this._onError.bind(this))
                .on("close", (reason) => this._onClose("transport close", reason));
        }
        /**
         * Called when connection is deemed open.
         *
         * @private
         */
        onOpen() {
            this.readyState = "open";
            SocketWithoutUpgrade.priorWebsocketSuccess =
                "websocket" === this.transport.name;
            this.emitReserved("open");
            this.flush();
        }
        /**
         * Handles a packet.
         *
         * @private
         */
        _onPacket(packet) {
            if ("opening" === this.readyState ||
                "open" === this.readyState ||
                "closing" === this.readyState) {
                this.emitReserved("packet", packet);
                // Socket is live - any packet counts
                this.emitReserved("heartbeat");
                switch (packet.type) {
                    case "open":
                        this.onHandshake(JSON.parse(packet.data));
                        break;
                    case "ping":
                        this._sendPacket("pong");
                        this.emitReserved("ping");
                        this.emitReserved("pong");
                        this._resetPingTimeout();
                        break;
                    case "error":
                        const err = new Error("server error");
                        // @ts-ignore
                        err.code = packet.data;
                        this._onError(err);
                        break;
                    case "message":
                        this.emitReserved("data", packet.data);
                        this.emitReserved("message", packet.data);
                        break;
                }
            }
        }
        /**
         * Called upon handshake completion.
         *
         * @param {Object} data - handshake obj
         * @private
         */
        onHandshake(data) {
            this.emitReserved("handshake", data);
            this.id = data.sid;
            this.transport.query.sid = data.sid;
            this._pingInterval = data.pingInterval;
            this._pingTimeout = data.pingTimeout;
            this._maxPayload = data.maxPayload;
            this.onOpen();
            // In case open handler closes socket
            if ("closed" === this.readyState)
                return;
            this._resetPingTimeout();
        }
        /**
         * Sets and resets ping timeout timer based on server pings.
         *
         * @private
         */
        _resetPingTimeout() {
            this.clearTimeoutFn(this._pingTimeoutTimer);
            const delay = this._pingInterval + this._pingTimeout;
            this._pingTimeoutTime = Date.now() + delay;
            this._pingTimeoutTimer = this.setTimeoutFn(() => {
                this._onClose("ping timeout");
            }, delay);
            if (this.opts.autoUnref) {
                this._pingTimeoutTimer.unref();
            }
        }
        /**
         * Called on `drain` event
         *
         * @private
         */
        _onDrain() {
            this.writeBuffer.splice(0, this._prevBufferLen);
            // setting prevBufferLen = 0 is very important
            // for example, when upgrading, upgrade packet is sent over,
            // and a nonzero prevBufferLen could cause problems on `drain`
            this._prevBufferLen = 0;
            if (0 === this.writeBuffer.length) {
                this.emitReserved("drain");
            }
            else {
                this.flush();
            }
        }
        /**
         * Flush write buffers.
         *
         * @private
         */
        flush() {
            if ("closed" !== this.readyState &&
                this.transport.writable &&
                !this.upgrading &&
                this.writeBuffer.length) {
                const packets = this._getWritablePackets();
                this.transport.send(packets);
                // keep track of current length of writeBuffer
                // splice writeBuffer and callbackBuffer on `drain`
                this._prevBufferLen = packets.length;
                this.emitReserved("flush");
            }
        }
        /**
         * Ensure the encoded size of the writeBuffer is below the maxPayload value sent by the server (only for HTTP
         * long-polling)
         *
         * @private
         */
        _getWritablePackets() {
            const shouldCheckPayloadSize = this._maxPayload &&
                this.transport.name === "polling" &&
                this.writeBuffer.length > 1;
            if (!shouldCheckPayloadSize) {
                return this.writeBuffer;
            }
            let payloadSize = 1; // first packet type
            for (let i = 0; i < this.writeBuffer.length; i++) {
                const data = this.writeBuffer[i].data;
                if (data) {
                    payloadSize += byteLength$1(data);
                }
                if (i > 0 && payloadSize > this._maxPayload) {
                    return this.writeBuffer.slice(0, i);
                }
                payloadSize += 2; // separator + packet type
            }
            return this.writeBuffer;
        }
        /**
         * Checks whether the heartbeat timer has expired but the socket has not yet been notified.
         *
         * Note: this method is private for now because it does not really fit the WebSocket API, but if we put it in the
         * `write()` method then the message would not be buffered by the Socket.IO client.
         *
         * @return {boolean}
         * @private
         */
        /* private */ _hasPingExpired() {
            if (!this._pingTimeoutTime)
                return true;
            const hasExpired = Date.now() > this._pingTimeoutTime;
            if (hasExpired) {
                this._pingTimeoutTime = 0;
                nextTick$1(() => {
                    this._onClose("ping timeout");
                }, this.setTimeoutFn);
            }
            return hasExpired;
        }
        /**
         * Sends a message.
         *
         * @param {String} msg - message.
         * @param {Object} options.
         * @param {Function} fn - callback function.
         * @return {Socket} for chaining.
         */
        write(msg, options, fn) {
            this._sendPacket("message", msg, options, fn);
            return this;
        }
        /**
         * Sends a message. Alias of {@link Socket#write}.
         *
         * @param {String} msg - message.
         * @param {Object} options.
         * @param {Function} fn - callback function.
         * @return {Socket} for chaining.
         */
        send(msg, options, fn) {
            this._sendPacket("message", msg, options, fn);
            return this;
        }
        /**
         * Sends a packet.
         *
         * @param {String} type: packet type.
         * @param {String} data.
         * @param {Object} options.
         * @param {Function} fn - callback function.
         * @private
         */
        _sendPacket(type, data, options, fn) {
            if ("function" === typeof data) {
                fn = data;
                data = undefined;
            }
            if ("function" === typeof options) {
                fn = options;
                options = null;
            }
            if ("closing" === this.readyState || "closed" === this.readyState) {
                return;
            }
            options = options || {};
            options.compress = false !== options.compress;
            const packet = {
                type: type,
                data: data,
                options: options,
            };
            this.emitReserved("packetCreate", packet);
            this.writeBuffer.push(packet);
            if (fn)
                this.once("flush", fn);
            this.flush();
        }
        /**
         * Closes the connection.
         */
        close() {
            const close = () => {
                this._onClose("forced close");
                this.transport.close();
            };
            const cleanupAndClose = () => {
                this.off("upgrade", cleanupAndClose);
                this.off("upgradeError", cleanupAndClose);
                close();
            };
            const waitForUpgrade = () => {
                // wait for upgrade to finish since we can't send packets while pausing a transport
                this.once("upgrade", cleanupAndClose);
                this.once("upgradeError", cleanupAndClose);
            };
            if ("opening" === this.readyState || "open" === this.readyState) {
                this.readyState = "closing";
                if (this.writeBuffer.length) {
                    this.once("drain", () => {
                        if (this.upgrading) {
                            waitForUpgrade();
                        }
                        else {
                            close();
                        }
                    });
                }
                else if (this.upgrading) {
                    waitForUpgrade();
                }
                else {
                    close();
                }
            }
            return this;
        }
        /**
         * Called upon transport error
         *
         * @private
         */
        _onError(err) {
            SocketWithoutUpgrade.priorWebsocketSuccess = false;
            if (this.opts.tryAllTransports &&
                this.transports.length > 1 &&
                this.readyState === "opening") {
                this.transports.shift();
                return this._open();
            }
            this.emitReserved("error", err);
            this._onClose("transport error", err);
        }
        /**
         * Called upon transport close.
         *
         * @private
         */
        _onClose(reason, description) {
            if ("opening" === this.readyState ||
                "open" === this.readyState ||
                "closing" === this.readyState) {
                // clear timers
                this.clearTimeoutFn(this._pingTimeoutTimer);
                // stop event from firing again for transport
                this.transport.removeAllListeners("close");
                // ensure transport won't stay open
                this.transport.close();
                // ignore further transport communication
                this.transport.removeAllListeners();
                if (withEventListeners$1) {
                    if (this._beforeunloadEventListener) {
                        removeEventListener("beforeunload", this._beforeunloadEventListener, false);
                    }
                    if (this._offlineEventListener) {
                        const i = OFFLINE_EVENT_LISTENERS$1.indexOf(this._offlineEventListener);
                        if (i !== -1) {
                            OFFLINE_EVENT_LISTENERS$1.splice(i, 1);
                        }
                    }
                }
                // set ready state
                this.readyState = "closed";
                // clear session id
                this.id = null;
                // emit close event
                this.emitReserved("close", reason, description);
                // clean buffers after, so users can still
                // grab the buffers on `close` event
                this.writeBuffer = [];
                this._prevBufferLen = 0;
            }
        }
    };
    SocketWithoutUpgrade$1.protocol = protocol$1;
    /**
     * This class provides a WebSocket-like interface to connect to an Engine.IO server. The connection will be established
     * with one of the available low-level transports, like HTTP long-polling, WebSocket or WebTransport.
     *
     * This class comes with an upgrade mechanism, which means that once the connection is established with the first
     * low-level transport, it will try to upgrade to a better transport.
     *
     * In order to allow tree-shaking, there are no transports included, that's why the `transports` option is mandatory.
     *
     * @example
     * import { SocketWithUpgrade, WebSocket } from "engine.io-client";
     *
     * const socket = new SocketWithUpgrade({
     *   transports: [WebSocket]
     * });
     *
     * socket.on("open", () => {
     *   socket.send("hello");
     * });
     *
     * @see SocketWithoutUpgrade
     * @see Socket
     */
    let SocketWithUpgrade$1 = class SocketWithUpgrade extends SocketWithoutUpgrade$1 {
        constructor() {
            super(...arguments);
            this._upgrades = [];
        }
        onOpen() {
            super.onOpen();
            if ("open" === this.readyState && this.opts.upgrade) {
                for (let i = 0; i < this._upgrades.length; i++) {
                    this._probe(this._upgrades[i]);
                }
            }
        }
        /**
         * Probes a transport.
         *
         * @param {String} name - transport name
         * @private
         */
        _probe(name) {
            let transport = this.createTransport(name);
            let failed = false;
            SocketWithoutUpgrade$1.priorWebsocketSuccess = false;
            const onTransportOpen = () => {
                if (failed)
                    return;
                transport.send([{ type: "ping", data: "probe" }]);
                transport.once("packet", (msg) => {
                    if (failed)
                        return;
                    if ("pong" === msg.type && "probe" === msg.data) {
                        this.upgrading = true;
                        this.emitReserved("upgrading", transport);
                        if (!transport)
                            return;
                        SocketWithoutUpgrade$1.priorWebsocketSuccess =
                            "websocket" === transport.name;
                        this.transport.pause(() => {
                            if (failed)
                                return;
                            if ("closed" === this.readyState)
                                return;
                            cleanup();
                            this.setTransport(transport);
                            transport.send([{ type: "upgrade" }]);
                            this.emitReserved("upgrade", transport);
                            transport = null;
                            this.upgrading = false;
                            this.flush();
                        });
                    }
                    else {
                        const err = new Error("probe error");
                        // @ts-ignore
                        err.transport = transport.name;
                        this.emitReserved("upgradeError", err);
                    }
                });
            };
            function freezeTransport() {
                if (failed)
                    return;
                // Any callback called by transport should be ignored since now
                failed = true;
                cleanup();
                transport.close();
                transport = null;
            }
            // Handle any error that happens while probing
            const onerror = (err) => {
                const error = new Error("probe error: " + err);
                // @ts-ignore
                error.transport = transport.name;
                freezeTransport();
                this.emitReserved("upgradeError", error);
            };
            function onTransportClose() {
                onerror("transport closed");
            }
            // When the socket is closed while we're probing
            function onclose() {
                onerror("socket closed");
            }
            // When the socket is upgraded while we're probing
            function onupgrade(to) {
                if (transport && to.name !== transport.name) {
                    freezeTransport();
                }
            }
            // Remove all listeners on the transport and on self
            const cleanup = () => {
                transport.removeListener("open", onTransportOpen);
                transport.removeListener("error", onerror);
                transport.removeListener("close", onTransportClose);
                this.off("close", onclose);
                this.off("upgrading", onupgrade);
            };
            transport.once("open", onTransportOpen);
            transport.once("error", onerror);
            transport.once("close", onTransportClose);
            this.once("close", onclose);
            this.once("upgrading", onupgrade);
            if (this._upgrades.indexOf("webtransport") !== -1 &&
                name !== "webtransport") {
                // favor WebTransport
                this.setTimeoutFn(() => {
                    if (!failed) {
                        transport.open();
                    }
                }, 200);
            }
            else {
                transport.open();
            }
        }
        onHandshake(data) {
            this._upgrades = this._filterUpgrades(data.upgrades);
            super.onHandshake(data);
        }
        /**
         * Filters upgrades, returning only those matching client transports.
         *
         * @param {Array} upgrades - server upgrades
         * @private
         */
        _filterUpgrades(upgrades) {
            const filteredUpgrades = [];
            for (let i = 0; i < upgrades.length; i++) {
                if (~this.transports.indexOf(upgrades[i]))
                    filteredUpgrades.push(upgrades[i]);
            }
            return filteredUpgrades;
        }
    };
    /**
     * This class provides a WebSocket-like interface to connect to an Engine.IO server. The connection will be established
     * with one of the available low-level transports, like HTTP long-polling, WebSocket or WebTransport.
     *
     * This class comes with an upgrade mechanism, which means that once the connection is established with the first
     * low-level transport, it will try to upgrade to a better transport.
     *
     * @example
     * import { Socket } from "engine.io-client";
     *
     * const socket = new Socket();
     *
     * socket.on("open", () => {
     *   socket.send("hello");
     * });
     *
     * @see SocketWithoutUpgrade
     * @see SocketWithUpgrade
     */
    let Socket$3 = class Socket extends SocketWithUpgrade$1 {
        constructor(uri, opts = {}) {
            const o = typeof uri === "object" ? uri : opts;
            if (!o.transports ||
                (o.transports && typeof o.transports[0] === "string")) {
                o.transports = (o.transports || ["polling", "websocket", "webtransport"])
                    .map((transportName) => transports$1[transportName])
                    .filter((t) => !!t);
            }
            super(uri, o);
        }
    };

    /**
     * URL parser.
     *
     * @param uri - url
     * @param path - the request path of the connection
     * @param loc - An object meant to mimic window.location.
     *        Defaults to window.location.
     * @public
     */
    function url$1(uri, path = "", loc) {
        let obj = uri;
        // default to window.location
        loc = loc || (typeof location !== "undefined" && location);
        if (null == uri)
            uri = loc.protocol + "//" + loc.host;
        // relative path support
        if (typeof uri === "string") {
            if ("/" === uri.charAt(0)) {
                if ("/" === uri.charAt(1)) {
                    uri = loc.protocol + uri;
                }
                else {
                    uri = loc.host + uri;
                }
            }
            if (!/^(https?|wss?):\/\//.test(uri)) {
                if ("undefined" !== typeof loc) {
                    uri = loc.protocol + "//" + uri;
                }
                else {
                    uri = "https://" + uri;
                }
            }
            // parse
            obj = parse$1(uri);
        }
        // make sure we treat `localhost:80` and `localhost` equally
        if (!obj.port) {
            if (/^(http|ws)$/.test(obj.protocol)) {
                obj.port = "80";
            }
            else if (/^(http|ws)s$/.test(obj.protocol)) {
                obj.port = "443";
            }
        }
        obj.path = obj.path || "/";
        const ipv6 = obj.host.indexOf(":") !== -1;
        const host = ipv6 ? "[" + obj.host + "]" : obj.host;
        // define unique id
        obj.id = obj.protocol + "://" + host + ":" + obj.port + path;
        // define href
        obj.href =
            obj.protocol +
                "://" +
                host +
                (loc && loc.port === obj.port ? "" : ":" + obj.port);
        return obj;
    }

    const withNativeArrayBuffer$3 = typeof ArrayBuffer === "function";
    const isView$2 = (obj) => {
        return typeof ArrayBuffer.isView === "function"
            ? ArrayBuffer.isView(obj)
            : obj.buffer instanceof ArrayBuffer;
    };
    const toString$1 = Object.prototype.toString;
    const withNativeBlob$2 = typeof Blob === "function" ||
        (typeof Blob !== "undefined" &&
            toString$1.call(Blob) === "[object BlobConstructor]");
    const withNativeFile$1 = typeof File === "function" ||
        (typeof File !== "undefined" &&
            toString$1.call(File) === "[object FileConstructor]");
    /**
     * Returns true if obj is a Buffer, an ArrayBuffer, a Blob or a File.
     *
     * @private
     */
    function isBinary$1(obj) {
        return ((withNativeArrayBuffer$3 && (obj instanceof ArrayBuffer || isView$2(obj))) ||
            (withNativeBlob$2 && obj instanceof Blob) ||
            (withNativeFile$1 && obj instanceof File));
    }
    function hasBinary$1(obj, toJSON) {
        if (!obj || typeof obj !== "object") {
            return false;
        }
        if (Array.isArray(obj)) {
            for (let i = 0, l = obj.length; i < l; i++) {
                if (hasBinary$1(obj[i])) {
                    return true;
                }
            }
            return false;
        }
        if (isBinary$1(obj)) {
            return true;
        }
        if (obj.toJSON &&
            typeof obj.toJSON === "function" &&
            arguments.length === 1) {
            return hasBinary$1(obj.toJSON(), true);
        }
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary$1(obj[key])) {
                return true;
            }
        }
        return false;
    }

    /**
     * Replaces every Buffer | ArrayBuffer | Blob | File in packet with a numbered placeholder.
     *
     * @param {Object} packet - socket.io event packet
     * @return {Object} with deconstructed packet and list of buffers
     * @public
     */
    function deconstructPacket$1(packet) {
        const buffers = [];
        const packetData = packet.data;
        const pack = packet;
        pack.data = _deconstructPacket$1(packetData, buffers);
        pack.attachments = buffers.length; // number of binary 'attachments'
        return { packet: pack, buffers: buffers };
    }
    function _deconstructPacket$1(data, buffers) {
        if (!data)
            return data;
        if (isBinary$1(data)) {
            const placeholder = { _placeholder: true, num: buffers.length };
            buffers.push(data);
            return placeholder;
        }
        else if (Array.isArray(data)) {
            const newData = new Array(data.length);
            for (let i = 0; i < data.length; i++) {
                newData[i] = _deconstructPacket$1(data[i], buffers);
            }
            return newData;
        }
        else if (typeof data === "object" && !(data instanceof Date)) {
            const newData = {};
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    newData[key] = _deconstructPacket$1(data[key], buffers);
                }
            }
            return newData;
        }
        return data;
    }
    /**
     * Reconstructs a binary packet from its placeholder packet and buffers
     *
     * @param {Object} packet - event packet with placeholders
     * @param {Array} buffers - binary buffers to put in placeholder positions
     * @return {Object} reconstructed packet
     * @public
     */
    function reconstructPacket$1(packet, buffers) {
        packet.data = _reconstructPacket$1(packet.data, buffers);
        delete packet.attachments; // no longer useful
        return packet;
    }
    function _reconstructPacket$1(data, buffers) {
        if (!data)
            return data;
        if (data && data._placeholder === true) {
            const isIndexValid = typeof data.num === "number" &&
                data.num >= 0 &&
                data.num < buffers.length;
            if (isIndexValid) {
                return buffers[data.num]; // appropriate buffer (should be natural order anyway)
            }
            else {
                throw new Error("illegal attachments");
            }
        }
        else if (Array.isArray(data)) {
            for (let i = 0; i < data.length; i++) {
                data[i] = _reconstructPacket$1(data[i], buffers);
            }
        }
        else if (typeof data === "object") {
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    data[key] = _reconstructPacket$1(data[key], buffers);
                }
            }
        }
        return data;
    }

    /**
     * These strings must not be used as event names, as they have a special meaning.
     */
    const RESERVED_EVENTS$3 = [
        "connect", // used on the client side
        "connect_error", // used on the client side
        "disconnect", // used on both sides
        "disconnecting", // used on the server side
        "newListener", // used by the Node.js EventEmitter
        "removeListener", // used by the Node.js EventEmitter
    ];
    var PacketType$1;
    (function (PacketType) {
        PacketType[PacketType["CONNECT"] = 0] = "CONNECT";
        PacketType[PacketType["DISCONNECT"] = 1] = "DISCONNECT";
        PacketType[PacketType["EVENT"] = 2] = "EVENT";
        PacketType[PacketType["ACK"] = 3] = "ACK";
        PacketType[PacketType["CONNECT_ERROR"] = 4] = "CONNECT_ERROR";
        PacketType[PacketType["BINARY_EVENT"] = 5] = "BINARY_EVENT";
        PacketType[PacketType["BINARY_ACK"] = 6] = "BINARY_ACK";
    })(PacketType$1 || (PacketType$1 = {}));
    /**
     * A socket.io Encoder instance
     */
    let Encoder$1 = class Encoder {
        /**
         * Encoder constructor
         *
         * @param {function} replacer - custom replacer to pass down to JSON.parse
         */
        constructor(replacer) {
            this.replacer = replacer;
        }
        /**
         * Encode a packet as a single string if non-binary, or as a
         * buffer sequence, depending on packet type.
         *
         * @param {Object} obj - packet object
         */
        encode(obj) {
            if (obj.type === PacketType$1.EVENT || obj.type === PacketType$1.ACK) {
                if (hasBinary$1(obj)) {
                    return this.encodeAsBinary({
                        type: obj.type === PacketType$1.EVENT
                            ? PacketType$1.BINARY_EVENT
                            : PacketType$1.BINARY_ACK,
                        nsp: obj.nsp,
                        data: obj.data,
                        id: obj.id,
                    });
                }
            }
            return [this.encodeAsString(obj)];
        }
        /**
         * Encode packet as string.
         */
        encodeAsString(obj) {
            // first is type
            let str = "" + obj.type;
            // attachments if we have them
            if (obj.type === PacketType$1.BINARY_EVENT ||
                obj.type === PacketType$1.BINARY_ACK) {
                str += obj.attachments + "-";
            }
            // if we have a namespace other than `/`
            // we append it followed by a comma `,`
            if (obj.nsp && "/" !== obj.nsp) {
                str += obj.nsp + ",";
            }
            // immediately followed by the id
            if (null != obj.id) {
                str += obj.id;
            }
            // json data
            if (null != obj.data) {
                str += JSON.stringify(obj.data, this.replacer);
            }
            return str;
        }
        /**
         * Encode packet as 'buffer sequence' by removing blobs, and
         * deconstructing packet into object with placeholders and
         * a list of buffers.
         */
        encodeAsBinary(obj) {
            const deconstruction = deconstructPacket$1(obj);
            const pack = this.encodeAsString(deconstruction.packet);
            const buffers = deconstruction.buffers;
            buffers.unshift(pack); // add packet info to beginning of data list
            return buffers; // write all the buffers
        }
    };
    /**
     * A socket.io Decoder instance
     *
     * @return {Object} decoder
     */
    let Decoder$1 = class Decoder extends Emitter$1 {
        /**
         * Decoder constructor
         */
        constructor(opts) {
            super();
            this.opts = Object.assign({
                reviver: undefined,
                maxAttachments: 10,
            }, typeof opts === "function" ? { reviver: opts } : opts);
        }
        /**
         * Decodes an encoded packet string into packet JSON.
         *
         * @param {String} obj - encoded packet
         */
        add(obj) {
            let packet;
            if (typeof obj === "string") {
                if (this.reconstructor) {
                    throw new Error("got plaintext data when reconstructing a packet");
                }
                packet = this.decodeString(obj);
                const isBinaryEvent = packet.type === PacketType$1.BINARY_EVENT;
                if (isBinaryEvent || packet.type === PacketType$1.BINARY_ACK) {
                    packet.type = isBinaryEvent ? PacketType$1.EVENT : PacketType$1.ACK;
                    // binary packet's json
                    this.reconstructor = new BinaryReconstructor$1(packet);
                    // no attachments, labeled binary but no binary data to follow
                    if (packet.attachments === 0) {
                        super.emitReserved("decoded", packet);
                    }
                }
                else {
                    // non-binary full packet
                    super.emitReserved("decoded", packet);
                }
            }
            else if (isBinary$1(obj) || obj.base64) {
                // raw binary data
                if (!this.reconstructor) {
                    throw new Error("got binary data when not reconstructing a packet");
                }
                else {
                    packet = this.reconstructor.takeBinaryData(obj);
                    if (packet) {
                        // received final buffer
                        this.reconstructor = null;
                        super.emitReserved("decoded", packet);
                    }
                }
            }
            else {
                throw new Error("Unknown type: " + obj);
            }
        }
        /**
         * Decode a packet String (JSON data)
         *
         * @param {String} str
         * @return {Object} packet
         */
        decodeString(str) {
            let i = 0;
            // look up type
            const p = {
                type: Number(str.charAt(0)),
            };
            if (PacketType$1[p.type] === undefined) {
                throw new Error("unknown packet type " + p.type);
            }
            // look up attachments if type binary
            if (p.type === PacketType$1.BINARY_EVENT ||
                p.type === PacketType$1.BINARY_ACK) {
                const start = i + 1;
                while (str.charAt(++i) !== "-" && i != str.length) { }
                const buf = str.substring(start, i);
                if (buf != Number(buf) || str.charAt(i) !== "-") {
                    throw new Error("Illegal attachments");
                }
                const n = Number(buf);
                if (!isInteger$1(n) || n < 0) {
                    throw new Error("Illegal attachments");
                }
                else if (n > this.opts.maxAttachments) {
                    throw new Error("too many attachments");
                }
                p.attachments = n;
            }
            // look up namespace (if any)
            if ("/" === str.charAt(i + 1)) {
                const start = i + 1;
                while (++i) {
                    const c = str.charAt(i);
                    if ("," === c)
                        break;
                    if (i === str.length)
                        break;
                }
                p.nsp = str.substring(start, i);
            }
            else {
                p.nsp = "/";
            }
            // look up id
            const next = str.charAt(i + 1);
            if ("" !== next && Number(next) == next) {
                const start = i + 1;
                while (++i) {
                    const c = str.charAt(i);
                    if (null == c || Number(c) != c) {
                        --i;
                        break;
                    }
                    if (i === str.length)
                        break;
                }
                p.id = Number(str.substring(start, i + 1));
            }
            // look up json data
            if (str.charAt(++i)) {
                const payload = this.tryParse(str.substr(i));
                if (Decoder.isPayloadValid(p.type, payload)) {
                    p.data = payload;
                }
                else {
                    throw new Error("invalid payload");
                }
            }
            return p;
        }
        tryParse(str) {
            try {
                return JSON.parse(str, this.opts.reviver);
            }
            catch (e) {
                return false;
            }
        }
        static isPayloadValid(type, payload) {
            switch (type) {
                case PacketType$1.CONNECT:
                    return isObject$1(payload);
                case PacketType$1.DISCONNECT:
                    return payload === undefined;
                case PacketType$1.CONNECT_ERROR:
                    return typeof payload === "string" || isObject$1(payload);
                case PacketType$1.EVENT:
                case PacketType$1.BINARY_EVENT:
                    return (Array.isArray(payload) &&
                        (typeof payload[0] === "number" ||
                            (typeof payload[0] === "string" &&
                                RESERVED_EVENTS$3.indexOf(payload[0]) === -1)));
                case PacketType$1.ACK:
                case PacketType$1.BINARY_ACK:
                    return Array.isArray(payload);
            }
        }
        /**
         * Deallocates a parser's resources
         */
        destroy() {
            if (this.reconstructor) {
                this.reconstructor.finishedReconstruction();
                this.reconstructor = null;
            }
        }
    };
    /**
     * A manager of a binary event's 'buffer sequence'. Should
     * be constructed whenever a packet of type BINARY_EVENT is
     * decoded.
     *
     * @param {Object} packet
     * @return {BinaryReconstructor} initialized reconstructor
     */
    let BinaryReconstructor$1 = class BinaryReconstructor {
        constructor(packet) {
            this.packet = packet;
            this.buffers = [];
            this.reconPack = packet;
        }
        /**
         * Method to be called when binary data received from connection
         * after a BINARY_EVENT packet.
         *
         * @param {Buffer | ArrayBuffer} binData - the raw binary data received
         * @return {null | Object} returns null if more binary data is expected or
         *   a reconstructed packet object if all buffers have been received.
         */
        takeBinaryData(binData) {
            this.buffers.push(binData);
            if (this.buffers.length === this.reconPack.attachments) {
                // done with buffer list
                const packet = reconstructPacket$1(this.reconPack, this.buffers);
                this.finishedReconstruction();
                return packet;
            }
            return null;
        }
        /**
         * Cleans up binary packet reconstruction variables.
         */
        finishedReconstruction() {
            this.reconPack = null;
            this.buffers = [];
        }
    };
    // see https://caniuse.com/mdn-javascript_builtins_number_isinteger
    const isInteger$1 = Number.isInteger ||
        function (value) {
            return (typeof value === "number" &&
                isFinite(value) &&
                Math.floor(value) === value);
        };
    // see https://stackoverflow.com/questions/8511281/check-if-a-value-is-an-object-in-javascript
    function isObject$1(value) {
        return Object.prototype.toString.call(value) === "[object Object]";
    }

    var parser$1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        Decoder: Decoder$1,
        Encoder: Encoder$1,
        get PacketType () { return PacketType$1; }
    });

    function on$2(obj, ev, fn) {
        obj.on(ev, fn);
        return function subDestroy() {
            obj.off(ev, fn);
        };
    }

    /**
     * Internal events.
     * These events can't be emitted by the user.
     */
    const RESERVED_EVENTS$2 = Object.freeze({
        connect: 1,
        connect_error: 1,
        disconnect: 1,
        disconnecting: 1,
        // EventEmitter reserved events: https://nodejs.org/api/events.html#events_event_newlistener
        newListener: 1,
        removeListener: 1,
    });
    /**
     * A Socket is the fundamental class for interacting with the server.
     *
     * A Socket belongs to a certain Namespace (by default /) and uses an underlying {@link Manager} to communicate.
     *
     * @example
     * const socket = io();
     *
     * socket.on("connect", () => {
     *   console.log("connected");
     * });
     *
     * // send an event to the server
     * socket.emit("foo", "bar");
     *
     * socket.on("foobar", () => {
     *   // an event was received from the server
     * });
     *
     * // upon disconnection
     * socket.on("disconnect", (reason) => {
     *   console.log(`disconnected due to ${reason}`);
     * });
     */
    let Socket$2 = class Socket extends Emitter$1 {
        /**
         * `Socket` constructor.
         */
        constructor(io, nsp, opts) {
            super();
            /**
             * Whether the socket is currently connected to the server.
             *
             * @example
             * const socket = io();
             *
             * socket.on("connect", () => {
             *   console.log(socket.connected); // true
             * });
             *
             * socket.on("disconnect", () => {
             *   console.log(socket.connected); // false
             * });
             */
            this.connected = false;
            /**
             * Whether the connection state was recovered after a temporary disconnection. In that case, any missed packets will
             * be transmitted by the server.
             */
            this.recovered = false;
            /**
             * Buffer for packets received before the CONNECT packet
             */
            this.receiveBuffer = [];
            /**
             * Buffer for packets that will be sent once the socket is connected
             */
            this.sendBuffer = [];
            /**
             * The queue of packets to be sent with retry in case of failure.
             *
             * Packets are sent one by one, each waiting for the server acknowledgement, in order to guarantee the delivery order.
             * @private
             */
            this._queue = [];
            /**
             * A sequence to generate the ID of the {@link QueuedPacket}.
             * @private
             */
            this._queueSeq = 0;
            this.ids = 0;
            /**
             * A map containing acknowledgement handlers.
             *
             * The `withError` attribute is used to differentiate handlers that accept an error as first argument:
             *
             * - `socket.emit("test", (err, value) => { ... })` with `ackTimeout` option
             * - `socket.timeout(5000).emit("test", (err, value) => { ... })`
             * - `const value = await socket.emitWithAck("test")`
             *
             * From those that don't:
             *
             * - `socket.emit("test", (value) => { ... });`
             *
             * In the first case, the handlers will be called with an error when:
             *
             * - the timeout is reached
             * - the socket gets disconnected
             *
             * In the second case, the handlers will be simply discarded upon disconnection, since the client will never receive
             * an acknowledgement from the server.
             *
             * @private
             */
            this.acks = {};
            this.flags = {};
            this.io = io;
            this.nsp = nsp;
            if (opts && opts.auth) {
                this.auth = opts.auth;
            }
            this._opts = Object.assign({}, opts);
            if (this.io._autoConnect)
                this.open();
        }
        /**
         * Whether the socket is currently disconnected
         *
         * @example
         * const socket = io();
         *
         * socket.on("connect", () => {
         *   console.log(socket.disconnected); // false
         * });
         *
         * socket.on("disconnect", () => {
         *   console.log(socket.disconnected); // true
         * });
         */
        get disconnected() {
            return !this.connected;
        }
        /**
         * Subscribe to open, close and packet events
         *
         * @private
         */
        subEvents() {
            if (this.subs)
                return;
            const io = this.io;
            this.subs = [
                on$2(io, "open", this.onopen.bind(this)),
                on$2(io, "packet", this.onpacket.bind(this)),
                on$2(io, "error", this.onerror.bind(this)),
                on$2(io, "close", this.onclose.bind(this)),
            ];
        }
        /**
         * Whether the Socket will try to reconnect when its Manager connects or reconnects.
         *
         * @example
         * const socket = io();
         *
         * console.log(socket.active); // true
         *
         * socket.on("disconnect", (reason) => {
         *   if (reason === "io server disconnect") {
         *     // the disconnection was initiated by the server, you need to manually reconnect
         *     console.log(socket.active); // false
         *   }
         *   // else the socket will automatically try to reconnect
         *   console.log(socket.active); // true
         * });
         */
        get active() {
            return !!this.subs;
        }
        /**
         * "Opens" the socket.
         *
         * @example
         * const socket = io({
         *   autoConnect: false
         * });
         *
         * socket.connect();
         */
        connect() {
            if (this.connected)
                return this;
            this.subEvents();
            if (!this.io["_reconnecting"])
                this.io.open(); // ensure open
            if ("open" === this.io._readyState)
                this.onopen();
            return this;
        }
        /**
         * Alias for {@link connect()}.
         */
        open() {
            return this.connect();
        }
        /**
         * Sends a `message` event.
         *
         * This method mimics the WebSocket.send() method.
         *
         * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send
         *
         * @example
         * socket.send("hello");
         *
         * // this is equivalent to
         * socket.emit("message", "hello");
         *
         * @return self
         */
        send(...args) {
            args.unshift("message");
            this.emit.apply(this, args);
            return this;
        }
        /**
         * Override `emit`.
         * If the event is in `events`, it's emitted normally.
         *
         * @example
         * socket.emit("hello", "world");
         *
         * // all serializable datastructures are supported (no need to call JSON.stringify)
         * socket.emit("hello", 1, "2", { 3: ["4"], 5: Uint8Array.from([6]) });
         *
         * // with an acknowledgement from the server
         * socket.emit("hello", "world", (val) => {
         *   // ...
         * });
         *
         * @return self
         */
        emit(ev, ...args) {
            var _a, _b, _c;
            if (RESERVED_EVENTS$2.hasOwnProperty(ev)) {
                throw new Error('"' + ev.toString() + '" is a reserved event name');
            }
            args.unshift(ev);
            if (this._opts.retries && !this.flags.fromQueue && !this.flags.volatile) {
                this._addToQueue(args);
                return this;
            }
            const packet = {
                type: PacketType$1.EVENT,
                data: args,
            };
            packet.options = {};
            packet.options.compress = this.flags.compress !== false;
            // event ack callback
            if ("function" === typeof args[args.length - 1]) {
                const id = this.ids++;
                const ack = args.pop();
                this._registerAckCallback(id, ack);
                packet.id = id;
            }
            const isTransportWritable = (_b = (_a = this.io.engine) === null || _a === void 0 ? void 0 : _a.transport) === null || _b === void 0 ? void 0 : _b.writable;
            const isConnected = this.connected && !((_c = this.io.engine) === null || _c === void 0 ? void 0 : _c._hasPingExpired());
            const discardPacket = this.flags.volatile && !isTransportWritable;
            if (discardPacket) ;
            else if (isConnected) {
                this.notifyOutgoingListeners(packet);
                this.packet(packet);
            }
            else {
                this.sendBuffer.push(packet);
            }
            this.flags = {};
            return this;
        }
        /**
         * @private
         */
        _registerAckCallback(id, ack) {
            var _a;
            const timeout = (_a = this.flags.timeout) !== null && _a !== void 0 ? _a : this._opts.ackTimeout;
            if (timeout === undefined) {
                this.acks[id] = ack;
                return;
            }
            // @ts-ignore
            const timer = this.io.setTimeoutFn(() => {
                delete this.acks[id];
                for (let i = 0; i < this.sendBuffer.length; i++) {
                    if (this.sendBuffer[i].id === id) {
                        this.sendBuffer.splice(i, 1);
                    }
                }
                ack.call(this, new Error("operation has timed out"));
            }, timeout);
            const fn = (...args) => {
                // @ts-ignore
                this.io.clearTimeoutFn(timer);
                ack.apply(this, args);
            };
            fn.withError = true;
            this.acks[id] = fn;
        }
        /**
         * Emits an event and waits for an acknowledgement
         *
         * @example
         * // without timeout
         * const response = await socket.emitWithAck("hello", "world");
         *
         * // with a specific timeout
         * try {
         *   const response = await socket.timeout(1000).emitWithAck("hello", "world");
         * } catch (err) {
         *   // the server did not acknowledge the event in the given delay
         * }
         *
         * @return a Promise that will be fulfilled when the server acknowledges the event
         */
        emitWithAck(ev, ...args) {
            return new Promise((resolve, reject) => {
                const fn = (arg1, arg2) => {
                    return arg1 ? reject(arg1) : resolve(arg2);
                };
                fn.withError = true;
                args.push(fn);
                this.emit(ev, ...args);
            });
        }
        /**
         * Add the packet to the queue.
         * @param args
         * @private
         */
        _addToQueue(args) {
            let ack;
            if (typeof args[args.length - 1] === "function") {
                ack = args.pop();
            }
            const packet = {
                id: this._queueSeq++,
                tryCount: 0,
                pending: false,
                args,
                flags: Object.assign({ fromQueue: true }, this.flags),
            };
            args.push((err, ...responseArgs) => {
                if (packet !== this._queue[0]) ;
                const hasError = err !== null;
                if (hasError) {
                    if (packet.tryCount > this._opts.retries) {
                        this._queue.shift();
                        if (ack) {
                            ack(err);
                        }
                    }
                }
                else {
                    this._queue.shift();
                    if (ack) {
                        ack(null, ...responseArgs);
                    }
                }
                packet.pending = false;
                return this._drainQueue();
            });
            this._queue.push(packet);
            this._drainQueue();
        }
        /**
         * Send the first packet of the queue, and wait for an acknowledgement from the server.
         * @param force - whether to resend a packet that has not been acknowledged yet
         *
         * @private
         */
        _drainQueue(force = false) {
            if (!this.connected || this._queue.length === 0) {
                return;
            }
            const packet = this._queue[0];
            if (packet.pending && !force) {
                return;
            }
            packet.pending = true;
            packet.tryCount++;
            this.flags = packet.flags;
            this.emit.apply(this, packet.args);
        }
        /**
         * Sends a packet.
         *
         * @param packet
         * @private
         */
        packet(packet) {
            packet.nsp = this.nsp;
            this.io._packet(packet);
        }
        /**
         * Called upon engine `open`.
         *
         * @private
         */
        onopen() {
            if (typeof this.auth == "function") {
                this.auth((data) => {
                    this._sendConnectPacket(data);
                });
            }
            else {
                this._sendConnectPacket(this.auth);
            }
        }
        /**
         * Sends a CONNECT packet to initiate the Socket.IO session.
         *
         * @param data
         * @private
         */
        _sendConnectPacket(data) {
            this.packet({
                type: PacketType$1.CONNECT,
                data: this._pid
                    ? Object.assign({ pid: this._pid, offset: this._lastOffset }, data)
                    : data,
            });
        }
        /**
         * Called upon engine or manager `error`.
         *
         * @param err
         * @private
         */
        onerror(err) {
            if (!this.connected) {
                this.emitReserved("connect_error", err);
            }
        }
        /**
         * Called upon engine `close`.
         *
         * @param reason
         * @param description
         * @private
         */
        onclose(reason, description) {
            this.connected = false;
            delete this.id;
            this.emitReserved("disconnect", reason, description);
            this._clearAcks();
        }
        /**
         * Clears the acknowledgement handlers upon disconnection, since the client will never receive an acknowledgement from
         * the server.
         *
         * @private
         */
        _clearAcks() {
            Object.keys(this.acks).forEach((id) => {
                const isBuffered = this.sendBuffer.some((packet) => String(packet.id) === id);
                if (!isBuffered) {
                    // note: handlers that do not accept an error as first argument are ignored here
                    const ack = this.acks[id];
                    delete this.acks[id];
                    if (ack.withError) {
                        ack.call(this, new Error("socket has been disconnected"));
                    }
                }
            });
        }
        /**
         * Called with socket packet.
         *
         * @param packet
         * @private
         */
        onpacket(packet) {
            const sameNamespace = packet.nsp === this.nsp;
            if (!sameNamespace)
                return;
            switch (packet.type) {
                case PacketType$1.CONNECT:
                    if (packet.data && packet.data.sid) {
                        this.onconnect(packet.data.sid, packet.data.pid);
                    }
                    else {
                        this.emitReserved("connect_error", new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));
                    }
                    break;
                case PacketType$1.EVENT:
                case PacketType$1.BINARY_EVENT:
                    this.onevent(packet);
                    break;
                case PacketType$1.ACK:
                case PacketType$1.BINARY_ACK:
                    this.onack(packet);
                    break;
                case PacketType$1.DISCONNECT:
                    this.ondisconnect();
                    break;
                case PacketType$1.CONNECT_ERROR:
                    this.destroy();
                    const err = new Error(packet.data.message);
                    // @ts-ignore
                    err.data = packet.data.data;
                    this.emitReserved("connect_error", err);
                    break;
            }
        }
        /**
         * Called upon a server event.
         *
         * @param packet
         * @private
         */
        onevent(packet) {
            const args = packet.data || [];
            if (null != packet.id) {
                args.push(this.ack(packet.id));
            }
            if (this.connected) {
                this.emitEvent(args);
            }
            else {
                this.receiveBuffer.push(Object.freeze(args));
            }
        }
        emitEvent(args) {
            if (this._anyListeners && this._anyListeners.length) {
                const listeners = this._anyListeners.slice();
                for (const listener of listeners) {
                    listener.apply(this, args);
                }
            }
            super.emit.apply(this, args);
            if (this._pid && args.length && typeof args[args.length - 1] === "string") {
                this._lastOffset = args[args.length - 1];
            }
        }
        /**
         * Produces an ack callback to emit with an event.
         *
         * @private
         */
        ack(id) {
            const self = this;
            let sent = false;
            return function (...args) {
                // prevent double callbacks
                if (sent)
                    return;
                sent = true;
                self.packet({
                    type: PacketType$1.ACK,
                    id: id,
                    data: args,
                });
            };
        }
        /**
         * Called upon a server acknowledgement.
         *
         * @param packet
         * @private
         */
        onack(packet) {
            const ack = this.acks[packet.id];
            if (typeof ack !== "function") {
                return;
            }
            delete this.acks[packet.id];
            // @ts-ignore FIXME ack is incorrectly inferred as 'never'
            if (ack.withError) {
                packet.data.unshift(null);
            }
            // @ts-ignore
            ack.apply(this, packet.data);
        }
        /**
         * Called upon server connect.
         *
         * @private
         */
        onconnect(id, pid) {
            this.id = id;
            this.recovered = pid && this._pid === pid;
            this._pid = pid; // defined only if connection state recovery is enabled
            this.connected = true;
            this.emitBuffered();
            this._drainQueue(true);
            this.emitReserved("connect");
        }
        /**
         * Emit buffered events (received and emitted).
         *
         * @private
         */
        emitBuffered() {
            this.receiveBuffer.forEach((args) => this.emitEvent(args));
            this.receiveBuffer = [];
            this.sendBuffer.forEach((packet) => {
                this.notifyOutgoingListeners(packet);
                this.packet(packet);
            });
            this.sendBuffer = [];
        }
        /**
         * Called upon server disconnect.
         *
         * @private
         */
        ondisconnect() {
            this.destroy();
            this.onclose("io server disconnect");
        }
        /**
         * Called upon forced client/server side disconnections,
         * this method ensures the manager stops tracking us and
         * that reconnections don't get triggered for this.
         *
         * @private
         */
        destroy() {
            if (this.subs) {
                // clean subscriptions to avoid reconnections
                this.subs.forEach((subDestroy) => subDestroy());
                this.subs = undefined;
            }
            this.io["_destroy"](this);
        }
        /**
         * Disconnects the socket manually. In that case, the socket will not try to reconnect.
         *
         * If this is the last active Socket instance of the {@link Manager}, the low-level connection will be closed.
         *
         * @example
         * const socket = io();
         *
         * socket.on("disconnect", (reason) => {
         *   // console.log(reason); prints "io client disconnect"
         * });
         *
         * socket.disconnect();
         *
         * @return self
         */
        disconnect() {
            if (this.connected) {
                this.packet({ type: PacketType$1.DISCONNECT });
            }
            // remove socket from pool
            this.destroy();
            if (this.connected) {
                // fire events
                this.onclose("io client disconnect");
            }
            return this;
        }
        /**
         * Alias for {@link disconnect()}.
         *
         * @return self
         */
        close() {
            return this.disconnect();
        }
        /**
         * Sets the compress flag.
         *
         * @example
         * socket.compress(false).emit("hello");
         *
         * @param compress - if `true`, compresses the sending data
         * @return self
         */
        compress(compress) {
            this.flags.compress = compress;
            return this;
        }
        /**
         * Sets a modifier for a subsequent event emission that the event message will be dropped when this socket is not
         * ready to send messages.
         *
         * @example
         * socket.volatile.emit("hello"); // the server may or may not receive it
         *
         * @returns self
         */
        get volatile() {
            this.flags.volatile = true;
            return this;
        }
        /**
         * Sets a modifier for a subsequent event emission that the callback will be called with an error when the
         * given number of milliseconds have elapsed without an acknowledgement from the server:
         *
         * @example
         * socket.timeout(5000).emit("my-event", (err) => {
         *   if (err) {
         *     // the server did not acknowledge the event in the given delay
         *   }
         * });
         *
         * @returns self
         */
        timeout(timeout) {
            this.flags.timeout = timeout;
            return this;
        }
        /**
         * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
         * callback.
         *
         * @example
         * socket.onAny((event, ...args) => {
         *   console.log(`got ${event}`);
         * });
         *
         * @param listener
         */
        onAny(listener) {
            this._anyListeners = this._anyListeners || [];
            this._anyListeners.push(listener);
            return this;
        }
        /**
         * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
         * callback. The listener is added to the beginning of the listeners array.
         *
         * @example
         * socket.prependAny((event, ...args) => {
         *   console.log(`got event ${event}`);
         * });
         *
         * @param listener
         */
        prependAny(listener) {
            this._anyListeners = this._anyListeners || [];
            this._anyListeners.unshift(listener);
            return this;
        }
        /**
         * Removes the listener that will be fired when any event is emitted.
         *
         * @example
         * const catchAllListener = (event, ...args) => {
         *   console.log(`got event ${event}`);
         * }
         *
         * socket.onAny(catchAllListener);
         *
         * // remove a specific listener
         * socket.offAny(catchAllListener);
         *
         * // or remove all listeners
         * socket.offAny();
         *
         * @param listener
         */
        offAny(listener) {
            if (!this._anyListeners) {
                return this;
            }
            if (listener) {
                const listeners = this._anyListeners;
                for (let i = 0; i < listeners.length; i++) {
                    if (listener === listeners[i]) {
                        listeners.splice(i, 1);
                        return this;
                    }
                }
            }
            else {
                this._anyListeners = [];
            }
            return this;
        }
        /**
         * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
         * e.g. to remove listeners.
         */
        listenersAny() {
            return this._anyListeners || [];
        }
        /**
         * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
         * callback.
         *
         * Note: acknowledgements sent to the server are not included.
         *
         * @example
         * socket.onAnyOutgoing((event, ...args) => {
         *   console.log(`sent event ${event}`);
         * });
         *
         * @param listener
         */
        onAnyOutgoing(listener) {
            this._anyOutgoingListeners = this._anyOutgoingListeners || [];
            this._anyOutgoingListeners.push(listener);
            return this;
        }
        /**
         * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
         * callback. The listener is added to the beginning of the listeners array.
         *
         * Note: acknowledgements sent to the server are not included.
         *
         * @example
         * socket.prependAnyOutgoing((event, ...args) => {
         *   console.log(`sent event ${event}`);
         * });
         *
         * @param listener
         */
        prependAnyOutgoing(listener) {
            this._anyOutgoingListeners = this._anyOutgoingListeners || [];
            this._anyOutgoingListeners.unshift(listener);
            return this;
        }
        /**
         * Removes the listener that will be fired when any event is emitted.
         *
         * @example
         * const catchAllListener = (event, ...args) => {
         *   console.log(`sent event ${event}`);
         * }
         *
         * socket.onAnyOutgoing(catchAllListener);
         *
         * // remove a specific listener
         * socket.offAnyOutgoing(catchAllListener);
         *
         * // or remove all listeners
         * socket.offAnyOutgoing();
         *
         * @param [listener] - the catch-all listener (optional)
         */
        offAnyOutgoing(listener) {
            if (!this._anyOutgoingListeners) {
                return this;
            }
            if (listener) {
                const listeners = this._anyOutgoingListeners;
                for (let i = 0; i < listeners.length; i++) {
                    if (listener === listeners[i]) {
                        listeners.splice(i, 1);
                        return this;
                    }
                }
            }
            else {
                this._anyOutgoingListeners = [];
            }
            return this;
        }
        /**
         * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
         * e.g. to remove listeners.
         */
        listenersAnyOutgoing() {
            return this._anyOutgoingListeners || [];
        }
        /**
         * Notify the listeners for each packet sent
         *
         * @param packet
         *
         * @private
         */
        notifyOutgoingListeners(packet) {
            if (this._anyOutgoingListeners && this._anyOutgoingListeners.length) {
                const listeners = this._anyOutgoingListeners.slice();
                for (const listener of listeners) {
                    listener.apply(this, packet.data);
                }
            }
        }
    };

    /**
     * Initialize backoff timer with `opts`.
     *
     * - `min` initial timeout in milliseconds [100]
     * - `max` max timeout [10000]
     * - `jitter` [0]
     * - `factor` [2]
     *
     * @param {Object} opts
     * @api public
     */
    function Backoff$1(opts) {
        opts = opts || {};
        this.ms = opts.min || 100;
        this.max = opts.max || 10000;
        this.factor = opts.factor || 2;
        this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
        this.attempts = 0;
    }
    /**
     * Return the backoff duration.
     *
     * @return {Number}
     * @api public
     */
    Backoff$1.prototype.duration = function () {
        var ms = this.ms * Math.pow(this.factor, this.attempts++);
        if (this.jitter) {
            var rand = Math.random();
            var deviation = Math.floor(rand * this.jitter * ms);
            ms = (Math.floor(rand * 10) & 1) == 0 ? ms - deviation : ms + deviation;
        }
        return Math.min(ms, this.max) | 0;
    };
    /**
     * Reset the number of attempts.
     *
     * @api public
     */
    Backoff$1.prototype.reset = function () {
        this.attempts = 0;
    };
    /**
     * Set the minimum duration
     *
     * @api public
     */
    Backoff$1.prototype.setMin = function (min) {
        this.ms = min;
    };
    /**
     * Set the maximum duration
     *
     * @api public
     */
    Backoff$1.prototype.setMax = function (max) {
        this.max = max;
    };
    /**
     * Set the jitter
     *
     * @api public
     */
    Backoff$1.prototype.setJitter = function (jitter) {
        this.jitter = jitter;
    };

    let Manager$1 = class Manager extends Emitter$1 {
        constructor(uri, opts) {
            var _a;
            super();
            this.nsps = {};
            this.subs = [];
            if (uri && "object" === typeof uri) {
                opts = uri;
                uri = undefined;
            }
            opts = opts || {};
            opts.path = opts.path || "/socket.io";
            this.opts = opts;
            installTimerFunctions$1(this, opts);
            this.reconnection(opts.reconnection !== false);
            this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
            this.reconnectionDelay(opts.reconnectionDelay || 1000);
            this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
            this.randomizationFactor((_a = opts.randomizationFactor) !== null && _a !== void 0 ? _a : 0.5);
            this.backoff = new Backoff$1({
                min: this.reconnectionDelay(),
                max: this.reconnectionDelayMax(),
                jitter: this.randomizationFactor(),
            });
            this.timeout(null == opts.timeout ? 20000 : opts.timeout);
            this._readyState = "closed";
            this.uri = uri;
            const _parser = opts.parser || parser$1;
            this.encoder = new _parser.Encoder();
            this.decoder = new _parser.Decoder();
            this._autoConnect = opts.autoConnect !== false;
            if (this._autoConnect)
                this.open();
        }
        reconnection(v) {
            if (!arguments.length)
                return this._reconnection;
            this._reconnection = !!v;
            if (!v) {
                this.skipReconnect = true;
            }
            return this;
        }
        reconnectionAttempts(v) {
            if (v === undefined)
                return this._reconnectionAttempts;
            this._reconnectionAttempts = v;
            return this;
        }
        reconnectionDelay(v) {
            var _a;
            if (v === undefined)
                return this._reconnectionDelay;
            this._reconnectionDelay = v;
            (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMin(v);
            return this;
        }
        randomizationFactor(v) {
            var _a;
            if (v === undefined)
                return this._randomizationFactor;
            this._randomizationFactor = v;
            (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setJitter(v);
            return this;
        }
        reconnectionDelayMax(v) {
            var _a;
            if (v === undefined)
                return this._reconnectionDelayMax;
            this._reconnectionDelayMax = v;
            (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMax(v);
            return this;
        }
        timeout(v) {
            if (!arguments.length)
                return this._timeout;
            this._timeout = v;
            return this;
        }
        /**
         * Starts trying to reconnect if reconnection is enabled and we have not
         * started reconnecting yet
         *
         * @private
         */
        maybeReconnectOnOpen() {
            // Only try to reconnect if it's the first time we're connecting
            if (!this._reconnecting &&
                this._reconnection &&
                this.backoff.attempts === 0) {
                // keeps reconnection from firing twice for the same reconnection loop
                this.reconnect();
            }
        }
        /**
         * Sets the current transport `socket`.
         *
         * @param {Function} fn - optional, callback
         * @return self
         * @public
         */
        open(fn) {
            if (~this._readyState.indexOf("open"))
                return this;
            this.engine = new Socket$3(this.uri, this.opts);
            const socket = this.engine;
            const self = this;
            this._readyState = "opening";
            this.skipReconnect = false;
            // emit `open`
            const openSubDestroy = on$2(socket, "open", function () {
                self.onopen();
                fn && fn();
            });
            const onError = (err) => {
                this.cleanup();
                this._readyState = "closed";
                this.emitReserved("error", err);
                if (fn) {
                    fn(err);
                }
                else {
                    // Only do this if there is no fn to handle the error
                    this.maybeReconnectOnOpen();
                }
            };
            // emit `error`
            const errorSub = on$2(socket, "error", onError);
            if (false !== this._timeout) {
                const timeout = this._timeout;
                // set timer
                const timer = this.setTimeoutFn(() => {
                    openSubDestroy();
                    onError(new Error("timeout"));
                    socket.close();
                }, timeout);
                if (this.opts.autoUnref) {
                    timer.unref();
                }
                this.subs.push(() => {
                    this.clearTimeoutFn(timer);
                });
            }
            this.subs.push(openSubDestroy);
            this.subs.push(errorSub);
            return this;
        }
        /**
         * Alias for open()
         *
         * @return self
         * @public
         */
        connect(fn) {
            return this.open(fn);
        }
        /**
         * Called upon transport open.
         *
         * @private
         */
        onopen() {
            // clear old subs
            this.cleanup();
            // mark as open
            this._readyState = "open";
            this.emitReserved("open");
            // add new subs
            const socket = this.engine;
            this.subs.push(on$2(socket, "ping", this.onping.bind(this)), on$2(socket, "data", this.ondata.bind(this)), on$2(socket, "error", this.onerror.bind(this)), on$2(socket, "close", this.onclose.bind(this)), 
            // @ts-ignore
            on$2(this.decoder, "decoded", this.ondecoded.bind(this)));
        }
        /**
         * Called upon a ping.
         *
         * @private
         */
        onping() {
            this.emitReserved("ping");
        }
        /**
         * Called with data.
         *
         * @private
         */
        ondata(data) {
            try {
                this.decoder.add(data);
            }
            catch (e) {
                this.onclose("parse error", e);
            }
        }
        /**
         * Called when parser fully decodes a packet.
         *
         * @private
         */
        ondecoded(packet) {
            // the nextTick call prevents an exception in a user-provided event listener from triggering a disconnection due to a "parse error"
            nextTick$1(() => {
                this.emitReserved("packet", packet);
            }, this.setTimeoutFn);
        }
        /**
         * Called upon socket error.
         *
         * @private
         */
        onerror(err) {
            this.emitReserved("error", err);
        }
        /**
         * Creates a new socket for the given `nsp`.
         *
         * @return {Socket}
         * @public
         */
        socket(nsp, opts) {
            let socket = this.nsps[nsp];
            if (!socket) {
                socket = new Socket$2(this, nsp, opts);
                this.nsps[nsp] = socket;
            }
            else if (this._autoConnect && !socket.active) {
                socket.connect();
            }
            return socket;
        }
        /**
         * Called upon a socket close.
         *
         * @param socket
         * @private
         */
        _destroy(socket) {
            const nsps = Object.keys(this.nsps);
            for (const nsp of nsps) {
                const socket = this.nsps[nsp];
                if (socket.active) {
                    return;
                }
            }
            this._close();
        }
        /**
         * Writes a packet.
         *
         * @param packet
         * @private
         */
        _packet(packet) {
            const encodedPackets = this.encoder.encode(packet);
            for (let i = 0; i < encodedPackets.length; i++) {
                this.engine.write(encodedPackets[i], packet.options);
            }
        }
        /**
         * Clean up transport subscriptions and packet buffer.
         *
         * @private
         */
        cleanup() {
            this.subs.forEach((subDestroy) => subDestroy());
            this.subs.length = 0;
            this.decoder.destroy();
        }
        /**
         * Close the current socket.
         *
         * @private
         */
        _close() {
            this.skipReconnect = true;
            this._reconnecting = false;
            this.onclose("forced close");
        }
        /**
         * Alias for close()
         *
         * @private
         */
        disconnect() {
            return this._close();
        }
        /**
         * Called when:
         *
         * - the low-level engine is closed
         * - the parser encountered a badly formatted packet
         * - all sockets are disconnected
         *
         * @private
         */
        onclose(reason, description) {
            var _a;
            this.cleanup();
            (_a = this.engine) === null || _a === void 0 ? void 0 : _a.close();
            this.backoff.reset();
            this._readyState = "closed";
            this.emitReserved("close", reason, description);
            if (this._reconnection && !this.skipReconnect) {
                this.reconnect();
            }
        }
        /**
         * Attempt a reconnection.
         *
         * @private
         */
        reconnect() {
            if (this._reconnecting || this.skipReconnect)
                return this;
            const self = this;
            if (this.backoff.attempts >= this._reconnectionAttempts) {
                this.backoff.reset();
                this.emitReserved("reconnect_failed");
                this._reconnecting = false;
            }
            else {
                const delay = this.backoff.duration();
                this._reconnecting = true;
                const timer = this.setTimeoutFn(() => {
                    if (self.skipReconnect)
                        return;
                    this.emitReserved("reconnect_attempt", self.backoff.attempts);
                    // check again for the case socket closed in above events
                    if (self.skipReconnect)
                        return;
                    self.open((err) => {
                        if (err) {
                            self._reconnecting = false;
                            self.reconnect();
                            this.emitReserved("reconnect_error", err);
                        }
                        else {
                            self.onreconnect();
                        }
                    });
                }, delay);
                if (this.opts.autoUnref) {
                    timer.unref();
                }
                this.subs.push(() => {
                    this.clearTimeoutFn(timer);
                });
            }
        }
        /**
         * Called upon successful reconnect.
         *
         * @private
         */
        onreconnect() {
            const attempt = this.backoff.attempts;
            this._reconnecting = false;
            this.backoff.reset();
            this.emitReserved("reconnect", attempt);
        }
    };

    /**
     * Managers cache.
     */
    const cache$1 = {};
    function lookup$2(uri, opts) {
        if (typeof uri === "object") {
            opts = uri;
            uri = undefined;
        }
        opts = opts || {};
        const parsed = url$1(uri, opts.path || "/socket.io");
        const source = parsed.source;
        const id = parsed.id;
        const path = parsed.path;
        const sameNamespace = cache$1[id] && path in cache$1[id]["nsps"];
        const newConnection = opts.forceNew ||
            opts["force new connection"] ||
            false === opts.multiplex ||
            sameNamespace;
        let io;
        if (newConnection) {
            io = new Manager$1(source, opts);
        }
        else {
            if (!cache$1[id]) {
                cache$1[id] = new Manager$1(source, opts);
            }
            io = cache$1[id];
        }
        if (parsed.query && !opts.query) {
            opts.query = parsed.queryKey;
        }
        return io.socket(parsed.path, opts);
    }
    // so that "lookup" can be used both as a function (e.g. `io(...)`) and as a
    // namespace (e.g. `io.connect(...)`), for backward compatibility
    Object.assign(lookup$2, {
        Manager: Manager$1,
        Socket: Socket$2,
        io: lookup$2,
        connect: lookup$2,
    });

    function getDefaultExportFromCjs (x) {
    	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
    }

    var socket_ioMsgpackParser$1 = {};

    var lib$1 = {};

    var encode_1$1;
    var hasRequiredEncode$1;

    function requireEncode$1 () {
    	if (hasRequiredEncode$1) return encode_1$1;
    	hasRequiredEncode$1 = 1;

    	function utf8Write(view, offset, str) {
    	  var c = 0;
    	  for (var i = 0, l = str.length; i < l; i++) {
    	    c = str.charCodeAt(i);
    	    if (c < 0x80) {
    	      view.setUint8(offset++, c);
    	    }
    	    else if (c < 0x800) {
    	      view.setUint8(offset++, 0xc0 | (c >> 6));
    	      view.setUint8(offset++, 0x80 | (c & 0x3f));
    	    }
    	    else if (c < 0xd800 || c >= 0xe000) {
    	      view.setUint8(offset++, 0xe0 | (c >> 12));
    	      view.setUint8(offset++, 0x80 | (c >> 6) & 0x3f);
    	      view.setUint8(offset++, 0x80 | (c & 0x3f));
    	    }
    	    else {
    	      i++;
    	      c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
    	      view.setUint8(offset++, 0xf0 | (c >> 18));
    	      view.setUint8(offset++, 0x80 | (c >> 12) & 0x3f);
    	      view.setUint8(offset++, 0x80 | (c >> 6) & 0x3f);
    	      view.setUint8(offset++, 0x80 | (c & 0x3f));
    	    }
    	  }
    	}

    	function utf8Length(str) {
    	  var c = 0, length = 0;
    	  for (var i = 0, l = str.length; i < l; i++) {
    	    c = str.charCodeAt(i);
    	    if (c < 0x80) {
    	      length += 1;
    	    }
    	    else if (c < 0x800) {
    	      length += 2;
    	    }
    	    else if (c < 0xd800 || c >= 0xe000) {
    	      length += 3;
    	    }
    	    else {
    	      i++;
    	      length += 4;
    	    }
    	  }
    	  return length;
    	}

    	function _encode(bytes, defers, value) {
    	  var type = typeof value, i = 0, l = 0, hi = 0, lo = 0, length = 0, size = 0;

    	  if (type === 'string') {
    	    length = utf8Length(value);

    	    // fixstr
    	    if (length < 0x20) {
    	      bytes.push(length | 0xa0);
    	      size = 1;
    	    }
    	    // str 8
    	    else if (length < 0x100) {
    	      bytes.push(0xd9, length);
    	      size = 2;
    	    }
    	    // str 16
    	    else if (length < 0x10000) {
    	      bytes.push(0xda, length >> 8, length);
    	      size = 3;
    	    }
    	    // str 32
    	    else if (length < 0x100000000) {
    	      bytes.push(0xdb, length >> 24, length >> 16, length >> 8, length);
    	      size = 5;
    	    } else {
    	      throw new Error('String too long');
    	    }
    	    defers.push({ _str: value, _length: length, _offset: bytes.length });
    	    return size + length;
    	  }
    	  if (type === 'number') {
    	    // TODO: encode to float 32?

    	    // float 64
    	    if (Math.floor(value) !== value || !isFinite(value)) {
    	      bytes.push(0xcb);
    	      defers.push({ _float: value, _length: 8, _offset: bytes.length });
    	      return 9;
    	    }

    	    if (value >= 0) {
    	      // positive fixnum
    	      if (value < 0x80) {
    	        bytes.push(value);
    	        return 1;
    	      }
    	      // uint 8
    	      if (value < 0x100) {
    	        bytes.push(0xcc, value);
    	        return 2;
    	      }
    	      // uint 16
    	      if (value < 0x10000) {
    	        bytes.push(0xcd, value >> 8, value);
    	        return 3;
    	      }
    	      // uint 32
    	      if (value < 0x100000000) {
    	        bytes.push(0xce, value >> 24, value >> 16, value >> 8, value);
    	        return 5;
    	      }
    	      // uint 64
    	      hi = (value / Math.pow(2, 32)) >> 0;
    	      lo = value >>> 0;
    	      bytes.push(0xcf, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
    	      return 9;
    	    } else {
    	      // negative fixnum
    	      if (value >= -32) {
    	        bytes.push(value);
    	        return 1;
    	      }
    	      // int 8
    	      if (value >= -128) {
    	        bytes.push(0xd0, value);
    	        return 2;
    	      }
    	      // int 16
    	      if (value >= -32768) {
    	        bytes.push(0xd1, value >> 8, value);
    	        return 3;
    	      }
    	      // int 32
    	      if (value >= -2147483648) {
    	        bytes.push(0xd2, value >> 24, value >> 16, value >> 8, value);
    	        return 5;
    	      }
    	      // int 64
    	      hi = Math.floor(value / Math.pow(2, 32));
    	      lo = value >>> 0;
    	      bytes.push(0xd3, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
    	      return 9;
    	    }
    	  }
    	  if (type === 'object') {
    	    // nil
    	    if (value === null) {
    	      bytes.push(0xc0);
    	      return 1;
    	    }

    	    if (Array.isArray(value)) {
    	      length = value.length;

    	      // fixarray
    	      if (length < 0x10) {
    	        bytes.push(length | 0x90);
    	        size = 1;
    	      }
    	      // array 16
    	      else if (length < 0x10000) {
    	        bytes.push(0xdc, length >> 8, length);
    	        size = 3;
    	      }
    	      // array 32
    	      else if (length < 0x100000000) {
    	        bytes.push(0xdd, length >> 24, length >> 16, length >> 8, length);
    	        size = 5;
    	      } else {
    	        throw new Error('Array too large');
    	      }
    	      for (i = 0; i < length; i++) {
    	        size += _encode(bytes, defers, value[i]);
    	      }
    	      return size;
    	    }

    	    // fixext 8 / Date
    	    if (value instanceof Date) {
    	      var time = value.getTime();
    	      hi = Math.floor(time / Math.pow(2, 32));
    	      lo = time >>> 0;
    	      bytes.push(0xd7, 0, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
    	      return 10;
    	    }

    	    if (value instanceof ArrayBuffer) {
    	      length = value.byteLength;

    	      // bin 8
    	      if (length < 0x100) {
    	        bytes.push(0xc4, length);
    	        size = 2;
    	      } else
    	      // bin 16
    	      if (length < 0x10000) {
    	        bytes.push(0xc5, length >> 8, length);
    	        size = 3;
    	      } else
    	      // bin 32
    	      if (length < 0x100000000) {
    	        bytes.push(0xc6, length >> 24, length >> 16, length >> 8, length);
    	        size = 5;
    	      } else {
    	        throw new Error('Buffer too large');
    	      }
    	      defers.push({ _bin: value, _length: length, _offset: bytes.length });
    	      return size + length;
    	    }

    	    if (typeof value.toJSON === 'function') {
    	      return _encode(bytes, defers, value.toJSON());
    	    }

    	    var keys = [], key = '';

    	    var allKeys = Object.keys(value);
    	    for (i = 0, l = allKeys.length; i < l; i++) {
    	      key = allKeys[i];
    	      if (typeof value[key] !== 'function') {
    	        keys.push(key);
    	      }
    	    }
    	    length = keys.length;

    	    // fixmap
    	    if (length < 0x10) {
    	      bytes.push(length | 0x80);
    	      size = 1;
    	    }
    	    // map 16
    	    else if (length < 0x10000) {
    	      bytes.push(0xde, length >> 8, length);
    	      size = 3;
    	    }
    	    // map 32
    	    else if (length < 0x100000000) {
    	      bytes.push(0xdf, length >> 24, length >> 16, length >> 8, length);
    	      size = 5;
    	    } else {
    	      throw new Error('Object too large');
    	    }

    	    for (i = 0; i < length; i++) {
    	      key = keys[i];
    	      size += _encode(bytes, defers, key);
    	      size += _encode(bytes, defers, value[key]);
    	    }
    	    return size;
    	  }
    	  // false/true
    	  if (type === 'boolean') {
    	    bytes.push(value ? 0xc3 : 0xc2);
    	    return 1;
    	  }
    	  // fixext 1 / undefined
    	  if (type === 'undefined') {
    	    bytes.push(0xd4, 0, 0);
    	    return 3;
    	  }
    	  throw new Error('Could not encode');
    	}

    	function encode(value) {
    	  var bytes = [];
    	  var defers = [];
    	  var size = _encode(bytes, defers, value);
    	  var buf = new ArrayBuffer(size);
    	  var view = new DataView(buf);

    	  var deferIndex = 0;
    	  var deferWritten = 0;
    	  var nextOffset = -1;
    	  if (defers.length > 0) {
    	    nextOffset = defers[0]._offset;
    	  }

    	  var defer, deferLength = 0, offset = 0;
    	  for (var i = 0, l = bytes.length; i < l; i++) {
    	    view.setUint8(deferWritten + i, bytes[i]);
    	    if (i + 1 !== nextOffset) { continue; }
    	    defer = defers[deferIndex];
    	    deferLength = defer._length;
    	    offset = deferWritten + nextOffset;
    	    if (defer._bin) {
    	      var bin = new Uint8Array(defer._bin);
    	      for (var j = 0; j < deferLength; j++) {
    	        view.setUint8(offset + j, bin[j]);
    	      }
    	    } else if (defer._str) {
    	      utf8Write(view, offset, defer._str);
    	    } else if (defer._float !== undefined) {
    	      view.setFloat64(offset, defer._float);
    	    }
    	    deferIndex++;
    	    deferWritten += deferLength;
    	    if (defers[deferIndex]) {
    	      nextOffset = defers[deferIndex]._offset;
    	    }
    	  }
    	  return buf;
    	}

    	encode_1$1 = encode;
    	return encode_1$1;
    }

    var decode_1$1;
    var hasRequiredDecode$1;

    function requireDecode$1 () {
    	if (hasRequiredDecode$1) return decode_1$1;
    	hasRequiredDecode$1 = 1;

    	function Decoder(buffer) {
    	  this._offset = 0;
    	  if (buffer instanceof ArrayBuffer || Object.prototype.toString.call(buffer) === "[object ArrayBuffer]") {
    	    this._buffer = buffer;
    	    this._view = new DataView(this._buffer);
    	  } else if (ArrayBuffer.isView(buffer)) {
    	    this._buffer = buffer.buffer;
    	    this._view = new DataView(this._buffer, buffer.byteOffset, buffer.byteLength);
    	  } else {
    	    throw new Error('Invalid argument');
    	  }
    	}

    	function utf8Read(view, offset, length) {
    	  var string = '', chr = 0;
    	  for (var i = offset, end = offset + length; i < end; i++) {
    	    var byte = view.getUint8(i);
    	    if ((byte & 0x80) === 0x00) {
    	      string += String.fromCharCode(byte);
    	      continue;
    	    }
    	    if ((byte & 0xe0) === 0xc0) {
    	      string += String.fromCharCode(
    	        ((byte & 0x1f) << 6) |
    	        (view.getUint8(++i) & 0x3f)
    	      );
    	      continue;
    	    }
    	    if ((byte & 0xf0) === 0xe0) {
    	      string += String.fromCharCode(
    	        ((byte & 0x0f) << 12) |
    	        ((view.getUint8(++i) & 0x3f) << 6) |
    	        ((view.getUint8(++i) & 0x3f) << 0)
    	      );
    	      continue;
    	    }
    	    if ((byte & 0xf8) === 0xf0) {
    	      chr = ((byte & 0x07) << 18) |
    	        ((view.getUint8(++i) & 0x3f) << 12) |
    	        ((view.getUint8(++i) & 0x3f) << 6) |
    	        ((view.getUint8(++i) & 0x3f) << 0);
    	      if (chr >= 0x010000) { // surrogate pair
    	        chr -= 0x010000;
    	        string += String.fromCharCode((chr >>> 10) + 0xD800, (chr & 0x3FF) + 0xDC00);
    	      } else {
    	        string += String.fromCharCode(chr);
    	      }
    	      continue;
    	    }
    	    throw new Error('Invalid byte ' + byte.toString(16));
    	  }
    	  return string;
    	}

    	Decoder.prototype._array = function (length) {
    	  var value = new Array(length);
    	  for (var i = 0; i < length; i++) {
    	    value[i] = this._parse();
    	  }
    	  return value;
    	};

    	Decoder.prototype._map = function (length) {
    	  var key = '', value = {};
    	  for (var i = 0; i < length; i++) {
    	    key = this._parse();
    	    value[key] = this._parse();
    	  }
    	  return value;
    	};

    	Decoder.prototype._str = function (length) {
    	  var value = utf8Read(this._view, this._offset, length);
    	  this._offset += length;
    	  return value;
    	};

    	Decoder.prototype._bin = function (length) {
    	  var value = this._buffer.slice(this._offset, this._offset + length);
    	  this._offset += length;
    	  return value;
    	};

    	Decoder.prototype._parse = function () {
    	  var prefix = this._view.getUint8(this._offset++);
    	  var value, length = 0, type = 0, hi = 0, lo = 0;

    	  if (prefix < 0xc0) {
    	    // positive fixint
    	    if (prefix < 0x80) {
    	      return prefix;
    	    }
    	    // fixmap
    	    if (prefix < 0x90) {
    	      return this._map(prefix & 0x0f);
    	    }
    	    // fixarray
    	    if (prefix < 0xa0) {
    	      return this._array(prefix & 0x0f);
    	    }
    	    // fixstr
    	    return this._str(prefix & 0x1f);
    	  }

    	  // negative fixint
    	  if (prefix > 0xdf) {
    	    return (0xff - prefix + 1) * -1;
    	  }

    	  switch (prefix) {
    	    // nil
    	    case 0xc0:
    	      return null;
    	    // false
    	    case 0xc2:
    	      return false;
    	    // true
    	    case 0xc3:
    	      return true;

    	    // bin
    	    case 0xc4:
    	      length = this._view.getUint8(this._offset);
    	      this._offset += 1;
    	      return this._bin(length);
    	    case 0xc5:
    	      length = this._view.getUint16(this._offset);
    	      this._offset += 2;
    	      return this._bin(length);
    	    case 0xc6:
    	      length = this._view.getUint32(this._offset);
    	      this._offset += 4;
    	      return this._bin(length);

    	    // ext
    	    case 0xc7:
    	      length = this._view.getUint8(this._offset);
    	      type = this._view.getInt8(this._offset + 1);
    	      this._offset += 2;
    	      return [type, this._bin(length)];
    	    case 0xc8:
    	      length = this._view.getUint16(this._offset);
    	      type = this._view.getInt8(this._offset + 2);
    	      this._offset += 3;
    	      return [type, this._bin(length)];
    	    case 0xc9:
    	      length = this._view.getUint32(this._offset);
    	      type = this._view.getInt8(this._offset + 4);
    	      this._offset += 5;
    	      return [type, this._bin(length)];

    	    // float
    	    case 0xca:
    	      value = this._view.getFloat32(this._offset);
    	      this._offset += 4;
    	      return value;
    	    case 0xcb:
    	      value = this._view.getFloat64(this._offset);
    	      this._offset += 8;
    	      return value;

    	    // uint
    	    case 0xcc:
    	      value = this._view.getUint8(this._offset);
    	      this._offset += 1;
    	      return value;
    	    case 0xcd:
    	      value = this._view.getUint16(this._offset);
    	      this._offset += 2;
    	      return value;
    	    case 0xce:
    	      value = this._view.getUint32(this._offset);
    	      this._offset += 4;
    	      return value;
    	    case 0xcf:
    	      hi = this._view.getUint32(this._offset) * Math.pow(2, 32);
    	      lo = this._view.getUint32(this._offset + 4);
    	      this._offset += 8;
    	      return hi + lo;

    	    // int
    	    case 0xd0:
    	      value = this._view.getInt8(this._offset);
    	      this._offset += 1;
    	      return value;
    	    case 0xd1:
    	      value = this._view.getInt16(this._offset);
    	      this._offset += 2;
    	      return value;
    	    case 0xd2:
    	      value = this._view.getInt32(this._offset);
    	      this._offset += 4;
    	      return value;
    	    case 0xd3:
    	      hi = this._view.getInt32(this._offset) * Math.pow(2, 32);
    	      lo = this._view.getUint32(this._offset + 4);
    	      this._offset += 8;
    	      return hi + lo;

    	    // fixext
    	    case 0xd4:
    	      type = this._view.getInt8(this._offset);
    	      this._offset += 1;
    	      if (type === 0x00) {
    	        this._offset += 1;
    	        return void 0;
    	      }
    	      return [type, this._bin(1)];
    	    case 0xd5:
    	      type = this._view.getInt8(this._offset);
    	      this._offset += 1;
    	      return [type, this._bin(2)];
    	    case 0xd6:
    	      type = this._view.getInt8(this._offset);
    	      this._offset += 1;
    	      return [type, this._bin(4)];
    	    case 0xd7:
    	      type = this._view.getInt8(this._offset);
    	      this._offset += 1;
    	      if (type === 0x00) {
    	        hi = this._view.getInt32(this._offset) * Math.pow(2, 32);
    	        lo = this._view.getUint32(this._offset + 4);
    	        this._offset += 8;
    	        return new Date(hi + lo);
    	      }
    	      return [type, this._bin(8)];
    	    case 0xd8:
    	      type = this._view.getInt8(this._offset);
    	      this._offset += 1;
    	      return [type, this._bin(16)];

    	    // str
    	    case 0xd9:
    	      length = this._view.getUint8(this._offset);
    	      this._offset += 1;
    	      return this._str(length);
    	    case 0xda:
    	      length = this._view.getUint16(this._offset);
    	      this._offset += 2;
    	      return this._str(length);
    	    case 0xdb:
    	      length = this._view.getUint32(this._offset);
    	      this._offset += 4;
    	      return this._str(length);

    	    // array
    	    case 0xdc:
    	      length = this._view.getUint16(this._offset);
    	      this._offset += 2;
    	      return this._array(length);
    	    case 0xdd:
    	      length = this._view.getUint32(this._offset);
    	      this._offset += 4;
    	      return this._array(length);

    	    // map
    	    case 0xde:
    	      length = this._view.getUint16(this._offset);
    	      this._offset += 2;
    	      return this._map(length);
    	    case 0xdf:
    	      length = this._view.getUint32(this._offset);
    	      this._offset += 4;
    	      return this._map(length);
    	  }

    	  throw new Error('Could not parse');
    	};

    	function decode(buffer) {
    	  var decoder = new Decoder(buffer);
    	  var value = decoder._parse();
    	  if (decoder._offset !== buffer.byteLength) {
    	    throw new Error((buffer.byteLength - decoder._offset) + ' trailing bytes');
    	  }
    	  return value;
    	}

    	decode_1$1 = decode;
    	return decode_1$1;
    }

    var hasRequiredLib$1;

    function requireLib$1 () {
    	if (hasRequiredLib$1) return lib$1;
    	hasRequiredLib$1 = 1;
    	lib$1.encode = requireEncode$1();
    	lib$1.decode = requireDecode$1();
    	return lib$1;
    }

    var componentEmitter$1 = {exports: {}};

    var hasRequiredComponentEmitter$1;

    function requireComponentEmitter$1 () {
    	if (hasRequiredComponentEmitter$1) return componentEmitter$1.exports;
    	hasRequiredComponentEmitter$1 = 1;
    	(function (module) {
    		/**
    		 * Expose `Emitter`.
    		 */

    		{
    		  module.exports = Emitter;
    		}

    		/**
    		 * Initialize a new `Emitter`.
    		 *
    		 * @api public
    		 */

    		function Emitter(obj) {
    		  if (obj) return mixin(obj);
    		}
    		/**
    		 * Mixin the emitter properties.
    		 *
    		 * @param {Object} obj
    		 * @return {Object}
    		 * @api private
    		 */

    		function mixin(obj) {
    		  for (var key in Emitter.prototype) {
    		    obj[key] = Emitter.prototype[key];
    		  }
    		  return obj;
    		}

    		/**
    		 * Listen on the given `event` with `fn`.
    		 *
    		 * @param {String} event
    		 * @param {Function} fn
    		 * @return {Emitter}
    		 * @api public
    		 */

    		Emitter.prototype.on =
    		Emitter.prototype.addEventListener = function(event, fn){
    		  this._callbacks = this._callbacks || {};
    		  (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
    		    .push(fn);
    		  return this;
    		};

    		/**
    		 * Adds an `event` listener that will be invoked a single
    		 * time then automatically removed.
    		 *
    		 * @param {String} event
    		 * @param {Function} fn
    		 * @return {Emitter}
    		 * @api public
    		 */

    		Emitter.prototype.once = function(event, fn){
    		  function on() {
    		    this.off(event, on);
    		    fn.apply(this, arguments);
    		  }

    		  on.fn = fn;
    		  this.on(event, on);
    		  return this;
    		};

    		/**
    		 * Remove the given callback for `event` or all
    		 * registered callbacks.
    		 *
    		 * @param {String} event
    		 * @param {Function} fn
    		 * @return {Emitter}
    		 * @api public
    		 */

    		Emitter.prototype.off =
    		Emitter.prototype.removeListener =
    		Emitter.prototype.removeAllListeners =
    		Emitter.prototype.removeEventListener = function(event, fn){
    		  this._callbacks = this._callbacks || {};

    		  // all
    		  if (0 == arguments.length) {
    		    this._callbacks = {};
    		    return this;
    		  }

    		  // specific event
    		  var callbacks = this._callbacks['$' + event];
    		  if (!callbacks) return this;

    		  // remove all handlers
    		  if (1 == arguments.length) {
    		    delete this._callbacks['$' + event];
    		    return this;
    		  }

    		  // remove specific handler
    		  var cb;
    		  for (var i = 0; i < callbacks.length; i++) {
    		    cb = callbacks[i];
    		    if (cb === fn || cb.fn === fn) {
    		      callbacks.splice(i, 1);
    		      break;
    		    }
    		  }

    		  // Remove event specific arrays for event types that no
    		  // one is subscribed for to avoid memory leak.
    		  if (callbacks.length === 0) {
    		    delete this._callbacks['$' + event];
    		  }

    		  return this;
    		};

    		/**
    		 * Emit `event` with the given args.
    		 *
    		 * @param {String} event
    		 * @param {Mixed} ...
    		 * @return {Emitter}
    		 */

    		Emitter.prototype.emit = function(event){
    		  this._callbacks = this._callbacks || {};

    		  var args = new Array(arguments.length - 1)
    		    , callbacks = this._callbacks['$' + event];

    		  for (var i = 1; i < arguments.length; i++) {
    		    args[i - 1] = arguments[i];
    		  }

    		  if (callbacks) {
    		    callbacks = callbacks.slice(0);
    		    for (var i = 0, len = callbacks.length; i < len; ++i) {
    		      callbacks[i].apply(this, args);
    		    }
    		  }

    		  return this;
    		};

    		/**
    		 * Return array of callbacks for `event`.
    		 *
    		 * @param {String} event
    		 * @return {Array}
    		 * @api public
    		 */

    		Emitter.prototype.listeners = function(event){
    		  this._callbacks = this._callbacks || {};
    		  return this._callbacks['$' + event] || [];
    		};

    		/**
    		 * Check if this emitter has `event` handlers.
    		 *
    		 * @param {String} event
    		 * @return {Boolean}
    		 * @api public
    		 */

    		Emitter.prototype.hasListeners = function(event){
    		  return !! this.listeners(event).length;
    		}; 
    	} (componentEmitter$1));
    	return componentEmitter$1.exports;
    }

    var hasRequiredSocket_ioMsgpackParser$1;

    function requireSocket_ioMsgpackParser$1 () {
    	if (hasRequiredSocket_ioMsgpackParser$1) return socket_ioMsgpackParser$1;
    	hasRequiredSocket_ioMsgpackParser$1 = 1;
    	var msgpack = requireLib$1();
    	var Emitter = requireComponentEmitter$1();

    	socket_ioMsgpackParser$1.protocol = 5;

    	/**
    	 * Packet types (see https://github.com/socketio/socket.io-protocol)
    	 */

    	var PacketType = (socket_ioMsgpackParser$1.PacketType = {
    	  CONNECT: 0,
    	  DISCONNECT: 1,
    	  EVENT: 2,
    	  ACK: 3,
    	  CONNECT_ERROR: 4,
    	});

    	var isInteger =
    	  Number.isInteger ||
    	  function (value) {
    	    return (
    	      typeof value === "number" &&
    	      isFinite(value) &&
    	      Math.floor(value) === value
    	    );
    	  };

    	var isString = function (value) {
    	  return typeof value === "string";
    	};

    	var isObject = function (value) {
    	  return Object.prototype.toString.call(value) === "[object Object]";
    	};

    	function Encoder() {}

    	Encoder.prototype.encode = function (packet) {
    	  return [msgpack.encode(packet)];
    	};

    	function Decoder() {}

    	Emitter(Decoder.prototype);

    	Decoder.prototype.add = function (obj) {
    	  var decoded = msgpack.decode(obj);
    	  this.checkPacket(decoded);
    	  this.emit("decoded", decoded);
    	};

    	function isDataValid(decoded) {
    	  switch (decoded.type) {
    	    case PacketType.CONNECT:
    	      return decoded.data === undefined || isObject(decoded.data);
    	    case PacketType.DISCONNECT:
    	      return decoded.data === undefined;
    	    case PacketType.CONNECT_ERROR:
    	      return isString(decoded.data) || isObject(decoded.data);
    	    default:
    	      return Array.isArray(decoded.data);
    	  }
    	}

    	Decoder.prototype.checkPacket = function (decoded) {
    	  var isTypeValid =
    	    isInteger(decoded.type) &&
    	    decoded.type >= PacketType.CONNECT &&
    	    decoded.type <= PacketType.CONNECT_ERROR;
    	  if (!isTypeValid) {
    	    throw new Error("invalid packet type");
    	  }

    	  if (!isString(decoded.nsp)) {
    	    throw new Error("invalid namespace");
    	  }

    	  if (!isDataValid(decoded)) {
    	    throw new Error("invalid payload");
    	  }

    	  var isAckValid = decoded.id === undefined || isInteger(decoded.id);
    	  if (!isAckValid) {
    	    throw new Error("invalid packet id");
    	  }
    	};

    	Decoder.prototype.destroy = function () {};

    	socket_ioMsgpackParser$1.Encoder = Encoder;
    	socket_ioMsgpackParser$1.Decoder = Decoder;
    	return socket_ioMsgpackParser$1;
    }

    var socket_ioMsgpackParserExports$1 = requireSocket_ioMsgpackParser$1();
    var index$1 = /*@__PURE__*/getDefaultExportFromCjs(socket_ioMsgpackParserExports$1);

    var _bundledMsgpackParser = /*#__PURE__*/_mergeNamespaces({
        __proto__: null,
        default: index$1
    }, [socket_ioMsgpackParserExports$1]);

    /**
     * core/socket.js — Socket.IO Connection
     *
     * Creates the SDK's own Socket.IO connection to the fishtank.live
     * WebSocket server. This is a clean, independent connection — it does
     * not modify or interfere with the site's own connection.
     *
     * The server uses MessagePack (binary) encoding over Socket.IO v4.
     *
     * Connection handshake sequence (discovered via frame inspection):
     * 1. Connect WebSocket with msgpack parser
     * 2. Socket.IO handshake (automatic)
     * 3. Auth token sent as part of handshake: { token: <JWT|null> }
     *    - null = anonymous read-only access (sufficient for all rooms)
     *    - JWT = authenticated (required only for sending messages)
     * 4. Server responds with session IDs
     * 5. Server sends chat:room ("Global") — default room
     * 6. Chat messages start flowing
     *
     * Room switching: emit('chat:room', 'Season Pass') to change which
     * room's messages are delivered. No authentication required for reading
     * any room — auth only gates message sending.
     */

    const SOCKET_URL = 'wss://ws.fishtank.live';

    // Auth token cookie name used by the site (Supabase auth)
    const AUTH_COOKIE_NAME$1 = 'sb-wcsaaupukpdmqdjcgaoo-auth-token';

    /**
     * Known chat room names.
     * The server defaults to Global. Other rooms require an explicit
     * chat:room emission after connecting.
     */
    const ROOMS = {
      GLOBAL: 'Global',
      SEASON_PASS: 'Season Pass',
      SEASON_PASS_XL: 'Season Pass XL',
    };

    // Connection state
    let socket = null;
    let connected = false;
    let authenticated = false;
    let connectionPromise = null;

    // Event listeners registered before connection is established
    const pendingListeners = [];

    // All registered listeners: eventName -> Set<callback>
    const listeners = new Map();

    /**
     * Known Socket.IO event names used by the site.
     * Discovered by inspecting WebSocket frames.
     */
    const EVENTS = {
      // Chat
      CHAT_MESSAGE: 'chat:message',
      // TTS
      TTS_INSERT: 'tts:insert',
      TTS_UPDATE: 'tts:update',

      // SFX
      SFX_INSERT: 'sfx:insert',
      SFX_UPDATE: 'sfx:update'};

    /**
     * Connect to the fishtank.live WebSocket server.
     *
     * This creates an independent connection using Socket.IO v4 with
     * MessagePack encoding.
     *
     * Supports two calling conventions:
     *
     *   // Extension usage — caller provides socket.io-client and msgpack parser
     *   await socket.connect(io, msgpackParser, { token: null });
     *
     *   // Userscript usage — uses bundled dependencies (UMD build only)
     *   await socket.connect({ token: null });
     *
     * @param {Function|Object} ioClientOrOptions - Either the socket.io-client `io`
     *   function (extension usage) or an options object (userscript usage)
     * @param {Object} [msgpackParserOrOptions] - The socket.io-msgpack-parser
     *   module (extension usage) or undefined (userscript usage)
     * @param {Object} [maybeOptions] - Connection options (extension usage only)
     * @param {string|null|undefined} options.token - JWT auth token. null = anonymous,
     *   undefined = auto-detect from cookie.
     * @returns {Promise} Resolves when connected and handshake is complete
     */
    async function connect(ioClientOrOptions, msgpackParserOrOptions, maybeOptions) {
      if (socket && connected) return socket;
      if (connectionPromise) return connectionPromise;

      // Detect calling convention:
      // connect(io, msgpackParser, opts) — first arg is a function (extension usage)
      // connect(opts) — first arg is an object or omitted (userscript usage)
      let ioClient, msgpackParser, options;

      if (typeof ioClientOrOptions === 'function') {
        // Extension usage
        ioClient = ioClientOrOptions;
        msgpackParser = msgpackParserOrOptions;
        options = maybeOptions || {};
      } else {
        // Userscript usage — use statically imported bundled dependencies
        options = ioClientOrOptions || {};
        ioClient = lookup$2;
        msgpackParser = _bundledMsgpackParser;
      }

      const {
        token = undefined,  // undefined = auto-detect, null = force unauthenticated
        autoSubscribe = true,
      } = options;

      // Resolve the auth token
      let authToken = token;
      if (authToken === undefined) {
        authToken = getAuthTokenFromCookie();
      }

      connectionPromise = new Promise((resolve, reject) => {
        try {
          // Store references for createConnection()
          _ioClient = ioClient;
          _msgpackParser = msgpackParser;

          socket = ioClient(SOCKET_URL, {
            parser: msgpackParser,
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 30000,
            autoConnect: true,
            // Socket.IO v4 auth option — sent as part of handshake
            auth: {
              token: authToken || null,
            },
          });

          socket.on('connect', () => {
            connected = true;
            authenticated = !!authToken;

            // Explicitly subscribe to Global chat — don't rely on the
            // server's default, which may be influenced by session state
            socket.emit('chat:room', ROOMS.GLOBAL);

            console.log(
                '[ftl-ext-sdk] Socket connected',
                authenticated ? '(authenticated)' : '(anonymous)'
            );

            // Register any listeners that were added before connection
            for (const { event, callback } of pendingListeners) {
              socket.on(event, callback);
            }
            pendingListeners.length = 0;

            resolve(socket);
          });

          socket.on('disconnect', (reason) => {
            connected = false;
            authenticated = false;
            console.log('[ftl-ext-sdk] Socket disconnected:', reason);
          });

          socket.on('connect_error', (err) => {
            console.warn('[ftl-ext-sdk] Socket connection error:', err.message);
            if (!connected) {
              reject(err);
              connectionPromise = null;
            }
          });
        } catch (err) {
          reject(err);
          connectionPromise = null;
        }
      });

      return connectionPromise;
    }

    /**
     * Listen for a Socket.IO event from the server.
     *
     * Can be called before connect() — listeners will be queued and
     * registered once the connection is established.
     *
     * Returns an unsubscribe function.
     *
     * @param {string} eventName - The event name (use EVENTS constants)
     * @param {Function} callback - Called with the event data
     * @returns {Function} Unsubscribe function
     */
    function on$1(eventName, callback) {
      // Track in our own registry
      if (!listeners.has(eventName)) {
        listeners.set(eventName, new Set());
      }
      listeners.get(eventName).add(callback);

      // Register on the socket if connected, otherwise queue
      if (socket && connected) {
        socket.on(eventName, callback);
      } else {
        pendingListeners.push({ event: eventName, callback });
      }

      // Return unsubscribe function
      return () => {
        listeners.get(eventName)?.delete(callback);
        if (socket) {
          socket.off(eventName, callback);
        }
      };
    }

    /**
     * Check if the socket is currently connected.
     */
    function isConnected() {
      return connected;
    }

    /**
     * Get the raw socket instance (for advanced use cases).
     * Returns null if not connected.
     */
    function getSocket() {
      return socket;
    }

    /**
     * Force the socket to disconnect and reconnect.
     * Useful as a recovery mechanism if the connection appears stale.
     * All existing event listeners are preserved across the reconnect.
     */
    function forceReconnect() {
      if (!socket) return;
      console.log('[ftl-ext-sdk] Forcing socket reconnect');
      socket.disconnect();
      // Socket.IO will automatically reconnect due to reconnection: true
      socket.connect();
    }

    /**
     * Attempt to extract the JWT auth token from the site's Supabase auth cookie.
     * Returns the access_token string or null if not found/not logged in.
     */
    function getAuthTokenFromCookie() {
      try {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name, ...valueParts] = cookie.trim().split('=');
          if (name === AUTH_COOKIE_NAME$1) {
            const value = decodeURIComponent(valueParts.join('='));
            try {
              const parsed = JSON.parse(value);
              // Supabase stores { access_token, refresh_token, ... }
              return parsed.access_token || parsed.token || null;
            } catch {
              // Might be a raw token string
              return value || null;
            }
          }
        }
      } catch (e) {
        console.warn('[ftl-ext-sdk] Failed to read auth cookie:', e.message);
      }
      return null;
    }

    // ── Internal: connection factory for multi-room support ─────────────
    // Stored references to the io client and parser passed to connect(),
    // so that rooms.js can create additional connections with the same config.

    let _ioClient = null;
    let _msgpackParser = null;

    /**
     * Create a new independent socket connection to the server.
     * Uses the same io client and parser that were passed to connect().
     *
     * This is an internal API for the rooms module — not intended for
     * direct consumer use.
     *
     * @param {Object} options
     * @param {string|null|undefined} options.token - Auth token.
     *   undefined = auto-detect from cookie, null = force anonymous.
     * @returns {Object|null} Raw Socket.IO socket instance, or null if
     *   connect() hasn't been called yet
     */
    function createConnection(options = {}) {
      if (!_ioClient || !_msgpackParser) {
        console.warn('[ftl-ext-sdk] Cannot create connection — connect() has not been called yet');
        return null;
      }

      const { token = undefined } = options;

      // Resolve auth token: undefined = auto-detect, null = anonymous
      let authToken = token;
      if (authToken === undefined) {
        authToken = getAuthTokenFromCookie();
      }

      return _ioClient(SOCKET_URL, {
        parser: _msgpackParser,
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 30000,
        autoConnect: true,
        auth: { token: authToken || null },
      });
    }

    /**
     * core/dom.js — DOM Query Helpers
     * 
     * Provides reliable ways to find elements on the new site.
     * Since the site uses Tailwind (no unique class names), we rely on:
     * - Stable element IDs
     * - Data attributes (e.g. data-react-window-index)
     * - Structural selectors as a last resort
     */


    /**
     * Known stable selectors (non-ID) that persist across site builds.
     */
    const SELECTORS = {
      /** react-window virtualised chat message items */
      CHAT_MESSAGE_ITEM: '[data-react-window-index]',
      /** Sonner toast notification container — always present after site load */
      TOAST_CONTAINER: 'section[aria-label^="Notifications"]',
      /** Sonner toast list elements */
      TOAST_LIST: 'ol[data-sonner-toaster]',
      /** Individual Sonner toast items */
      TOAST_ITEM: 'li[data-sonner-toast]',
    };

    /**
     * Observe a DOM element for mutations.
     * Returns a cleanup function that disconnects the observer.
     * 
     * @param {HTMLElement} element - Element to observe
     * @param {Function} callback - MutationObserver callback
     * @param {Object} options - MutationObserver options
     * @returns {Function} Disconnect function
     */
    function observe(element, callback, options = {}) {
      const config = {
        childList: options.childList !== false,
        subtree: options.subtree || false,
        attributes: options.attributes || false,
        characterData: options.characterData || false,
      };
      if (options.attributeFilter) {
        config.attributeFilter = options.attributeFilter;
      }
      
      const observer = new MutationObserver(callback);
      observer.observe(element, config);
      
      return () => observer.disconnect();
    }

    /**
     * Wait for an element matching a selector to appear in the DOM.
     * Returns a promise that resolves with the element.
     * 
     * @param {string} selector - CSS selector to wait for
     * @param {number} timeout - Max wait time in ms (default 30s)
     * @returns {Promise<HTMLElement>}
     */
    function waitForElement(selector, timeout = 30000) {
      return new Promise((resolve, reject) => {
        const existing = document.querySelector(selector);
        if (existing) return resolve(existing);
        
        const timer = setTimeout(() => {
          observer.disconnect();
          reject(new Error(`[ftl-ext-sdk] Timeout waiting for "${selector}"`));
        }, timeout);
        
        const observer = new MutationObserver(() => {
          const el = document.querySelector(selector);
          if (el) {
            clearTimeout(timer);
            observer.disconnect();
            resolve(el);
          }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }

    /**
     * core/site-detect.js — Environment Detection
     *
     * Detects which version of the site we're on and provides
     * readiness checking for SDK initialisation.
     *
     * IMPORTANT: This module NEVER creates persistent body-level observers.
     * The site generates thousands of chat mutations per second — a body
     * observer with subtree:true would process every single one and
     * effectively crash the page.
     *
     * All waiting/detection uses setInterval polling instead.
     */

    /**
     * Detect which version of the site we're on.
     *
     * @returns {'current'|'classic'|'unknown'}
     */
    function getSiteVersion() {
      const host = window.location.hostname;
      if (host === 'classic.fishtank.live') return 'classic';
      if (host === 'fishtank.live' || host === 'www.fishtank.live') return 'current';
      return 'unknown';
    }

    /**
     * Check if the current page is the classic site.
     */
    function isClassic() {
      return getSiteVersion() === 'classic';
    }

    /**
     * Check if the current page is the new/current site.
     */
    function isCurrent() {
      return getSiteVersion() === 'current';
    }

    /**
     * Check if the site appears ready for SDK use.
     * Looks for key elements that indicate the app has loaded.
     */
    function isSiteReady() {
      if (isCurrent()) {
        return (
            document.getElementById('chat-input') !== null ||
            document.querySelector('[data-react-window-index]') !== null
        );
      }

      if (isClassic()) {
        return !!document.querySelector('[class*="chat_chat__"]');
      }

      return false;
    }

    /**
     * Wait for the site to be ready, then call the callback.
     *
     * Uses setInterval polling — NOT a MutationObserver on document.body.
     * Polling at 250ms is negligible overhead compared to a body observer
     * that would fire on every DOM mutation (thousands per second on this site).
     *
     * @param {Function} callback - Called when the site is ready
     * @param {Object} options
     * @param {number} options.interval - Poll interval in ms (default 250)
     * @param {number} options.timeout - Max wait in ms (default 30000)
     * @returns {Function} Cancel function
     */
    function whenReady(callback, options = {}) {
      const { interval = 250, timeout = 30000 } = options;

      // Check immediately
      if (isSiteReady()) {
        setTimeout(callback, 0);
        return () => {};
      }

      const start = Date.now();

      const check = setInterval(() => {
        if (isSiteReady()) {
          clearInterval(check);
          callback();
        } else if (Date.now() - start > timeout) {
          clearInterval(check);
          console.warn('[ftl-ext-sdk] Site ready timeout after', timeout, 'ms.');
        }
      }, interval);

      return () => clearInterval(check);
    }

    // ---------------------------------------------------------------------------
    // Current user detection
    // ---------------------------------------------------------------------------

    let _currentUser = null;

    /**
     * CSS selector for the username element in the top bar.
     */
    const USERNAME_SELECTOR = '.fixed.top-\\[calc\\(env\\(safe-area-inset-top\\)\\/2\\)\\] .whitespace-nowrap.font-bold';

    /**
     * Read the logged-in user's display name from the top bar.
     * Returns null if not logged in or element not yet in DOM.
     */
    function _readUsernameFromDom() {
      const el = document.querySelector(USERNAME_SELECTOR);
      return el?.textContent?.trim() || null;
    }

    /**
     * Wait for the username to appear in the DOM, then call the callback.
     *
     * Uses setInterval polling — NOT a persistent body observer.
     * Checks every 500ms, gives up after timeout.
     * Once found, the username is cached and the polling stops.
     *
     * @param {Function} callback - Called with the username string
     * @param {number} timeout - Max wait in ms (default 30000)
     * @returns {Function} Cancel function
     */
    function onUserDetected(callback, timeout = 30000) {
      // Already cached
      if (_currentUser) {
        setTimeout(() => callback(_currentUser), 0);
        return () => {};
      }

      // Check DOM immediately
      const immediate = _readUsernameFromDom();
      if (immediate) {
        _currentUser = immediate;
        setTimeout(() => callback(_currentUser), 0);
        return () => {};
      }

      // Poll until found
      const start = Date.now();

      const check = setInterval(() => {
        const name = _readUsernameFromDom();
        if (name) {
          _currentUser = name;
          clearInterval(check);
          callback(_currentUser);
        } else if (Date.now() - start > timeout) {
          clearInterval(check);
          // User might not be logged in — that's fine, not an error
        }
      }, 500);

      return () => clearInterval(check);
    }

    // ---------------------------------------------------------------------------
    // Current user ID detection (via Supabase auth cookie)
    // ---------------------------------------------------------------------------
    // The site stores a Supabase JWT in a non-HttpOnly cookie that content
    // scripts can read via document.cookie. The JWT payload contains the
    // user's UUID in the `sub` field. We decode the payload (base64, no
    // verification needed) to extract it.
    //
    // The cookie may not exist immediately on page load — it's set after
    // the auth flow completes. We poll until it appears.

    const AUTH_COOKIE_NAME = 'sb-wcsaaupukpdmqdjcgaoo-auth-token';

    let _currentUserId = null;

    /**
     * Read the user ID from the Supabase auth cookie.
     * Decodes the JWT payload to extract the `sub` field.
     * Returns the user UUID string or null if not available.
     */
    function _readUserIdFromCookie() {
      try {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name, ...valueParts] = cookie.trim().split('=');
          if (name === AUTH_COOKIE_NAME) {
            const value = decodeURIComponent(valueParts.join('='));

            // Cookie value is a JSON array: ["access_token", "refresh_token"]
            // or a JSON object: {access_token, refresh_token}
            let token;
            try {
              const parsed = JSON.parse(value);
              token = Array.isArray(parsed) ? parsed[0] : (parsed.access_token || parsed.token);
            } catch {
              token = value;
            }

            if (!token) return null;

            // Decode JWT payload (middle segment, base64url)
            const parts = token.split('.');
            if (parts.length !== 3) return null;

            // base64url → base64 → decode
            const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const decoded = JSON.parse(atob(payload));
            return decoded.sub || decoded.uid || null;
          }
        }
      } catch {
        // Cookie not present or malformed — user not logged in
      }
      return null;
    }

    /**
     * Wait for the user's auth cookie to appear, then call the callback
     * with the user ID.
     *
     * Uses setInterval polling — NOT a persistent body observer.
     * Checks every 500ms, gives up after timeout.
     * Once found, the user ID is cached and the polling stops.
     *
     * @param {Function} callback - Called with the user ID string
     * @param {number} timeout - Max wait in ms (default 30000)
     * @returns {Function} Cancel function
     */
    function onUserIdDetected(callback, timeout = 30000) {
      // Already cached
      if (_currentUserId) {
        setTimeout(() => callback(_currentUserId), 0);
        return () => {};
      }

      // Check cookie immediately
      const immediate = _readUserIdFromCookie();
      if (immediate) {
        _currentUserId = immediate;
        setTimeout(() => callback(_currentUserId), 0);
        return () => {};
      }

      // Poll until found
      const start = Date.now();

      const check = setInterval(() => {
        const userId = _readUserIdFromCookie();
        if (userId) {
          _currentUserId = userId;
          clearInterval(check);
          callback(_currentUserId);
        } else if (Date.now() - start > timeout) {
          clearInterval(check);
          // User might not be logged in — that's fine, not an error
        }
      }, 500);

      return () => clearInterval(check);
    }

    /**
     * core/storage.js — Storage Wrapper
     * 
     * Simple localStorage wrapper with JSON serialisation and error handling.
     * Works identically in browser extensions and Tampermonkey scripts.
     */

    /**
     * Default prefix for SDK storage keys.
     * Prevents collisions with the site's own localStorage usage.
     */
    const DEFAULT_PREFIX = 'ftl-sdk:';

    /**
     * Get a value from localStorage.
     * Automatically parses JSON.
     * 
     * @param {string} key - Storage key
     * @param {*} defaultValue - Returned if key doesn't exist or parsing fails
     * @param {boolean} prefixed - Whether to add the SDK prefix (default true)
     * @returns {*} Parsed value or defaultValue
     */
    function get(key, defaultValue = null, prefixed = true) {
      try {
        const fullKey = prefixed ? DEFAULT_PREFIX + key : key;
        const raw = localStorage.getItem(fullKey);
        return raw !== null ? JSON.parse(raw) : defaultValue;
      } catch {
        return defaultValue;
      }
    }

    /**
     * Set a value in localStorage.
     * Automatically serialises to JSON.
     * 
     * @param {string} key - Storage key
     * @param {*} value - Value to store (must be JSON-serialisable)
     * @param {boolean} prefixed - Whether to add the SDK prefix (default true)
     * @returns {boolean} True if successful
     */
    function set(key, value, prefixed = true) {
      try {
        const fullKey = prefixed ? DEFAULT_PREFIX + key : key;
        localStorage.setItem(fullKey, JSON.stringify(value));
        return true;
      } catch (e) {
        console.warn('[ftl-ext-sdk] Storage write failed:', e.message);
        return false;
      }
    }

    /**
     * chat/messages.js — Chat Message Interception (Normalised)
     *
     * Listens for chat messages, TTS, and SFX events via the SDK's
     * Socket.IO connection. Normalises raw socket data into clean,
     * consistent objects so consumers don't need to handle quirks
     * like array-wrapped messages, role flag priority, or mention
     * object formats.
     *
     * TTS and SFX events are deduplicated automatically — the socket
     * fires multiple times per event (status changes), so only the
     * first occurrence is delivered to callbacks.
     *
     * Socket listeners are registered lazily on the first callback
     * registration — no need to call startListening() manually.
     *
     * RAW DATA ACCESS:
     * Every normalised object includes a `raw` property containing
     * the original socket data for advanced use cases.
     */


    // ── Callback registries ─────────────────────────────────────────────

    const messageCallbacks = new Set();
    const ttsCallbacks = new Set();
    const sfxCallbacks = new Set();

    // ── Deduplication state ─────────────────────────────────────────────

    const recentTtsIds = new Set();
    const recentSfxKeys = new Set();
    const DEDUP_CAP = 500;

    /**
     * Add a key to a dedup set, evicting the oldest entry if over cap.
     * Returns true if the key is new, false if it was a duplicate.
     */
    function dedupAdd(set, key) {
      if (set.has(key)) return false;
      set.add(key);
      if (set.size > DEDUP_CAP) {
        const first = set.values().next().value;
        set.delete(first);
      }
      return true;
    }

    // ── Lazy listener init ──────────────────────────────────────────────

    let listenersStarted = false;

    function ensureListening() {
      if (listenersStarted) return;
      listenersStarted = true;

      // Chat messages
      on$1(EVENTS.CHAT_MESSAGE, (data) => {
        const normalised = normaliseChat(data);
        if (!normalised) return;
        for (const cb of messageCallbacks) {
          try { cb(normalised); }
          catch (e) { console.error('[ftl-ext-sdk] Chat message callback error:', e); }
        }
      });

      // TTS — server sends tts:insert and/or tts:update (inconsistent,
      // likely tied to approval flow). Listen on both, dedup handles overlap.
      const ttsHandler = (data) => {
        const normalised = normaliseTts(data);
        if (!normalised) return;
        for (const cb of ttsCallbacks) {
          try { cb(normalised); }
          catch (e) { console.error('[ftl-ext-sdk] TTS callback error:', e); }
        }
      };
      on$1(EVENTS.TTS_INSERT, ttsHandler);
      on$1(EVENTS.TTS_UPDATE, ttsHandler);

      // SFX — same situation: server sends sfx:insert and/or sfx:update.
      const sfxHandler = (data) => {
        const normalised = normaliseSfx(data);
        if (!normalised) return;
        for (const cb of sfxCallbacks) {
          try { cb(normalised); }
          catch (e) { console.error('[ftl-ext-sdk] SFX callback error:', e); }
        }
      };
      on$1(EVENTS.SFX_INSERT, sfxHandler);
      on$1(EVENTS.SFX_UPDATE, sfxHandler);
    }

    // ── Normalisation: Chat ─────────────────────────────────────────────

    /**
     * Normalise a raw chat:message socket event.
     *
     * Handles:
     * - Array unwrapping (socket delivers [{...}] not {...})
     * - Role priority: staff > mod > fish > grandMarshal > epic > null
     * - Avatar filename extraction from CDN URL
     * - Mention normalisation to [{displayName, userId}]
     */
    function normaliseChat(data, chatRoom = 'Global') {
      const raw = Array.isArray(data) ? data[0] : data;
      if (!raw) return null;

      // Avatar: extract filename from full CDN URL
      // "https://cdn.fishtank.live/avatars/rchl.png" → "rchl.png"
      const photoURL = raw.user?.photoURL || '';
      const avatar = photoURL.split('/').pop() || null;

      // Role priority: staff > mod > fish > grandMarshal > epic > null
      const meta = raw.metadata || {};
      const role = meta.isAdmin ? 'staff'
          : meta.isMod ? 'mod'
              : meta.isFish ? 'fish'
                  : meta.isGrandMarshall ? 'grandMarshal'
                      : meta.isEpic ? 'epic'
                          : null;

      // Normalise mentions to consistent [{displayName, userId}] shape
      // Raw data sends objects: {displayName, userId}
      // But could theoretically send strings, so handle both
      const rawMentions = raw.mentions || [];
      const mentions = rawMentions.map(m => {
        if (typeof m === 'string') return { displayName: m, userId: null };
        return { displayName: m.displayName || '', userId: m.userId || null };
      });

      return {
        username:    raw.user?.displayName || '???',
        message:     raw.message || '',
        role,
        colour:      raw.user?.customUsernameColor || null,
        avatar,
        clan:        raw.user?.clan || null,
        endorsement: raw.user?.endorsement || null,
        mentions,
        chatRoom,
        raw,
      };
    }

    // ── Normalisation: TTS ──────────────────────────────────────────────

    /**
     * Normalise a raw tts:update socket event.
     * Deduplicates by TTS ID — the socket fires for each status change.
     */
    function normaliseTts(data) {
      if (!data) return null;

      const ttsId = data.id || null;
      if (ttsId && !dedupAdd(recentTtsIds, ttsId)) return null;

      return {
        username: data.displayName || '???',
        message:  data.message || '',
        voice:    data.voice || '?',
        room:     data.room || '?',
        audioId:  ttsId,
        clanTag:  data.clanTag || null,
        raw:      data,
      };
    }

    // ── Normalisation: SFX ──────────────────────────────────────────────

    /**
     * Normalise a raw sfx:update socket event.
     * Deduplicates by ID or composite key (username:sound:room).
     */
    function normaliseSfx(data) {
      if (!data) return null;

      const sfxKey = data.id || `${data.displayName}:${data.sound || data.message}:${data.room}`;
      if (!dedupAdd(recentSfxKeys, sfxKey)) return null;

      // Extract audio filename from CDN URL for slim storage
      const sfxUrl = data.url || '';
      const audioFile = sfxUrl.split('/').pop() || null;

      return {
        username:  data.displayName || '???',
        message:   data.sound || data.message || '???',
        room:      data.room || '?',
        audioFile,
        clanTag:   data.clanTag || null,
        raw:       data,
      };
    }

    // ── Public API: callback registration ───────────────────────────────

    /**
     * Register a callback for new chat messages.
     *
     * The callback receives a normalised message object:
     * {
     *   username: string,          // Display name
     *   message: string,           // Message text
     *   role: string|null,         // 'staff' | 'mod' | 'fish' | 'grandMarshal' | 'epic' | null
     *   colour: string|null,       // Custom username colour (hex)
     *   avatar: string|null,       // Avatar filename (e.g. "rchl.png")
     *   clan: string|null,         // Clan tag
     *   endorsement: string|null,  // Endorsement badge text
     *   mentions: Array<{displayName: string, userId: string|null}>,
     *   chatRoom: string,          // 'Global' | 'Season Pass' | 'Season Pass XL'
     *   raw: Object,               // Original socket data
     * }
     *
     * @param {Function} callback - Called with the normalised message
     * @returns {Function} Unsubscribe function
     */
    function onMessage(callback) {
      ensureListening();
      messageCallbacks.add(callback);
      return () => messageCallbacks.delete(callback);
    }

    /**
     * Register a callback for TTS events (deduplicated).
     *
     * The callback receives a normalised TTS object:
     * {
     *   username: string,      // Display name of sender
     *   message: string,       // TTS message text
     *   voice: string,         // Voice name (e.g. "Brainrot")
     *   room: string,          // Room code (e.g. "brrr-5")
     *   audioId: string|null,  // TTS ID (for CDN audio URL)
     *   clanTag: string|null,  // Sender's clan tag
     *   raw: Object,           // Original socket data
     * }
     *
     * @param {Function} callback - Called with the normalised TTS object
     * @returns {Function} Unsubscribe function
     */
    function onTTS(callback) {
      ensureListening();
      ttsCallbacks.add(callback);
      return () => ttsCallbacks.delete(callback);
    }

    /**
     * Register a callback for SFX events (deduplicated).
     *
     * The callback receives a normalised SFX object:
     * {
     *   username: string,       // Display name of sender
     *   message: string,        // Sound name
     *   room: string,           // Room code
     *   audioFile: string|null, // Audio filename from CDN URL
     *   clanTag: string|null,   // Sender's clan tag
     *   raw: Object,            // Original socket data
     * }
     *
     * @param {Function} callback - Called with the normalised SFX object
     * @returns {Function} Unsubscribe function
     */
    function onSFX(callback) {
      ensureListening();
      sfxCallbacks.add(callback);
      return () => sfxCallbacks.delete(callback);
    }

    // ── Internal: dispatch functions for multi-room support ─────────────
    // These allow rooms.js to feed events from additional sockets through
    // the same normalisation pipeline and callback registry. Not intended
    // for direct consumer use.

    /**
     * Normalise and dispatch a raw chat:message event from a room socket.
     * @param {*} data - Raw socket event data
     * @param {string} chatRoom - Room name (e.g. 'Season Pass')
     */
    function _dispatchChat(data, chatRoom) {
      const normalised = normaliseChat(data, chatRoom);
      if (!normalised) return;
      for (const cb of messageCallbacks) {
        try { cb(normalised); }
        catch (e) { console.error('[ftl-ext-sdk] Chat message callback error:', e); }
      }
    }

    /**
     * Normalise and dispatch a raw tts event from a room socket.
     * @param {*} data - Raw socket event data
     */
    function _dispatchTts(data) {
      const normalised = normaliseTts(data);
      if (!normalised) return;
      for (const cb of ttsCallbacks) {
        try { cb(normalised); }
        catch (e) { console.error('[ftl-ext-sdk] TTS callback error:', e); }
      }
    }

    /**
     * Normalise and dispatch a raw sfx event from a room socket.
     * @param {*} data - Raw socket event data
     */
    function _dispatchSfx(data) {
      const normalised = normaliseSfx(data);
      if (!normalised) return;
      for (const cb of sfxCallbacks) {
        try { cb(normalised); }
        catch (e) { console.error('[ftl-ext-sdk] SFX callback error:', e); }
      }
    }

    /**
     * chat/rooms.js — Multi-Room Chat Subscription
     *
     * Manages additional socket connections for monitoring chat rooms
     * beyond the default Global room. Each subscribed room gets its own
     * independent Socket.IO connection that emits `chat:room` to switch
     * the server's message feed.
     *
     * Messages from all room sockets are funnelled through the same
     * normalisation pipeline in chat/messages.js, so consumers using
     * onMessage/onTTS/onSFX receive events from all subscribed rooms
     * transparently. Each normalised chat message includes a `chatRoom`
     * field indicating which room it came from.
     *
     * The primary socket (from socket.connect()) always handles Global.
     * This module only manages the additional room connections.
     *
     * Usage:
     *   import { chat } from 'ftl-ext-sdk';
     *
     *   // After socket.connect()...
     *   chat.rooms.subscribe('Season Pass');
     *   chat.rooms.subscribe('Season Pass XL');
     *
     *   // Messages from all rooms now flow through chat.messages.onMessage()
     *   // Each message has msg.chatRoom: 'Global' | 'Season Pass' | 'Season Pass XL'
     *
     *   chat.rooms.unsubscribe('Season Pass XL');
     *   chat.rooms.getSubscribed();  // ['Season Pass']
     *   chat.rooms.unsubscribeAll();
     */


    // ── State ───────────────────────────────────────────────────────────

    // Active room connections: roomName → { socket, connected }
    const roomSockets = new Map();

    // ── Public API ──────────────────────────────────────────────────────

    /**
     * Subscribe to a chat room. Opens a new socket connection and emits
     * `chat:room` to start receiving that room's messages.
     *
     * Messages will flow through the existing chat.messages.onMessage(),
     * onTTS(), and onSFX() callbacks with the `chatRoom` field set.
     *
     * No-op if already subscribed to this room. No-op for 'Global'
     * (always handled by the primary socket).
     *
     * @param {string} roomName - Room to subscribe to (use ROOMS constants)
     * @returns {Promise<boolean>} True if subscription succeeded
     */
    async function subscribe(roomName) {
      // Global is always on the primary socket
      if (roomName === ROOMS.GLOBAL) {
        console.warn('[ftl-ext-sdk] Global room is always active on the primary socket');
        return true;
      }

      // Already subscribed
      if (roomSockets.has(roomName)) return true;

      const socket = createConnection({ token: null });
      if (!socket) {
        console.warn(`[ftl-ext-sdk] Cannot subscribe to "${roomName}" — primary socket not connected yet`);
        return false;
      }

      const entry = { socket, connected: false };
      roomSockets.set(roomName, entry);

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.warn(`[ftl-ext-sdk] Room "${roomName}" connection timed out`);
          cleanup(roomName);
          resolve(false);
        }, 10000);

        socket.on('connect', () => {
          entry.connected = true;
          clearTimeout(timeout);

          // Subscribe to the room
          socket.emit('chat:room', roomName);

          // Wire up event listeners that dispatch through messages.js
          wireRoomListeners(socket, roomName);

          console.log(`[ftl-ext-sdk] Subscribed to room: ${roomName}`);
          resolve(true);
        });

        socket.on('disconnect', (reason) => {
          entry.connected = false;
          console.log(`[ftl-ext-sdk] Room "${roomName}" disconnected: ${reason}`);
        });

        // Handle reconnection — re-emit chat:room after reconnect
        socket.io.on('reconnect', () => {
          entry.connected = true;
          socket.emit('chat:room', roomName);
          console.log(`[ftl-ext-sdk] Room "${roomName}" reconnected, re-subscribed`);
        });

        socket.on('connect_error', (err) => {
          if (!entry.connected) {
            clearTimeout(timeout);
            console.warn(`[ftl-ext-sdk] Room "${roomName}" connection error: ${err.message}`);
            cleanup(roomName);
            resolve(false);
          }
        });
      });
    }

    // ── Internal ────────────────────────────────────────────────────────

    /**
     * Wire up event listeners on a room socket that dispatch through
     * the messages.js normalisation pipeline.
     */
    function wireRoomListeners(socket, roomName) {
      // Chat messages — dispatch with the room name
      socket.on(EVENTS.CHAT_MESSAGE, (data) => {
        _dispatchChat(data, roomName);
      });

      // TTS — listen on both insert and update, dedup handles overlap
      const ttsHandler = (data) => _dispatchTts(data);
      socket.on(EVENTS.TTS_INSERT, ttsHandler);
      socket.on(EVENTS.TTS_UPDATE, ttsHandler);

      // SFX — same pattern
      const sfxHandler = (data) => _dispatchSfx(data);
      socket.on(EVENTS.SFX_INSERT, sfxHandler);
      socket.on(EVENTS.SFX_UPDATE, sfxHandler);
    }

    /**
     * Clean up a room subscription — disconnect and remove from state.
     */
    function cleanup(roomName) {
      const entry = roomSockets.get(roomName);
      if (!entry) return;

      try {
        entry.socket.disconnect();
      } catch {}

      roomSockets.delete(roomName);
      console.log(`[ftl-ext-sdk] Unsubscribed from room: ${roomName}`);
    }

    /**
     * player/streams.js — Live Stream Detection & Room Names
     * 
     * Helpers for detecting which stream is playing, and resolving
     * room codes (e.g. "brrr-5") to human-readable names (e.g. "Bar").
     * 
     * Room names are fetched from the live-streams API and cached
     * in localStorage. The cache is merged (not replaced) so that
     * room names from previous seasons persist for historical log entries.
     */


    const LIVE_STREAMS_API = 'https://api.fishtank.live/v1/live-streams';
    const ROOM_CACHE_KEY = 'room-names';

    // In-memory map: room ID → display name
    let roomMap = {};

    /**
     * Fetch room names from the live-streams API and update the cache.
     * 
     * Merges new data into the existing cache so that names from
     * previous seasons are preserved (for old log entries).
     * 
     * Call once on startup. Non-blocking — if the API fails,
     * cached names are still available and raw codes are shown
     * for any uncached rooms.
     * 
     * @returns {Promise<void>}
     */
    function fetchRoomNames() {
      // Load cached names first so they're available immediately
      const cached = get(ROOM_CACHE_KEY, {});
      roomMap = { ...cached };

      return fetch(LIVE_STREAMS_API)
        .then(r => r.json())
        .then(data => {
          const streams = data.liveStreams || [];
          for (const stream of streams) {
            if (stream.id && stream.name) {
              roomMap[stream.id] = stream.name;
            }
          }
          // Persist merged map (old + new names)
          set(ROOM_CACHE_KEY, roomMap);
        })
        .catch(() => {
          // API failed — cached names are still in roomMap
        });
    }

    /**
     * Convert a room code like "brrr-5" to a human-readable name like "Bar".
     * 
     * Returns the original code if no match is found (API not loaded
     * yet, or room not in cache).
     * 
     * @param {string} code - Room ID from socket data (e.g. "brrr-5")
     * @returns {string} Human-readable room name
     */
    function roomName(code) {
      if (!code) return '?';
      return roomMap[code] || code;
    }

    /**
     * ui/keyboard.js — Keyboard Shortcut Registration
     * 
     * Provides a clean API for registering keyboard shortcuts that
     * automatically skip when the user is typing in input fields.
     */

    const shortcuts = new Map();
    let listenerAttached = false;

    /**
     * Register a keyboard shortcut.
     * 
     * @param {string} id - Unique identifier for this shortcut
     * @param {Object} options - Shortcut configuration
     * @param {string} options.key - The key to listen for (e.g. 'e', 'F', 'Escape')
     * @param {boolean} options.ctrl - Require Ctrl key (default false)
     * @param {boolean} options.alt - Require Alt key (default false)
     * @param {boolean} options.shift - Require Shift key (default false)
     * @param {boolean} options.meta - Require Meta/Cmd key (default false)
     * @param {boolean} options.skipInputs - Don't fire when user is typing (default true)
     * @param {boolean} options.preventDefault - Prevent default browser action (default true)
     * @param {boolean} options.stopPropagation - Stop event from reaching other handlers (default false)
     * @param {Function} callback - Called when the shortcut is triggered
     * @returns {Function} Unregister function
     */
    function register(id, options, callback) {
      if (!listenerAttached) attachListener();
      
      shortcuts.set(id, {
        key: options.key.toLowerCase(),
        ctrl: options.ctrl || false,
        alt: options.alt || false,
        shift: options.shift || false,
        meta: options.meta || false,
        skipInputs: options.skipInputs !== false,
        preventDefault: options.preventDefault !== false,
        stopPropagation: options.stopPropagation || false,
        callback,
      });
      
      return () => shortcuts.delete(id);
    }

    /**
     * Check if the user is currently focused on a text input.
     * 
     * @returns {boolean}
     */
    function isUserTyping() {
      const active = document.activeElement;
      if (!active) return false;
      
      return (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.isContentEditable ||
        active.getAttribute('role') === 'textbox'
      );
    }

    /**
     * Attach the global keydown listener.
     * Called once on first shortcut registration.
     */
    function attachListener() {
      document.addEventListener('keydown', (e) => {
        for (const [id, shortcut] of shortcuts) {
          // Skip if user is typing and shortcut respects inputs
          if (shortcut.skipInputs && isUserTyping()) continue;
          
          // Check the key matches
          if (e.key.toLowerCase() !== shortcut.key) continue;
          
          // Check required modifiers are pressed
          if (shortcut.ctrl && !e.ctrlKey) continue;
          if (shortcut.alt && !e.altKey) continue;
          if (shortcut.shift && !e.shiftKey) continue;
          if (shortcut.meta && !e.metaKey) continue;
          
          // Check non-required modifiers are NOT pressed
          if (!shortcut.ctrl && e.ctrlKey) continue;
          if (!shortcut.alt && e.altKey) continue;
          if (!shortcut.shift && e.shiftKey) continue;
          if (!shortcut.meta && e.metaKey) continue;
          
          // Match found
          if (shortcut.preventDefault) e.preventDefault();
          if (shortcut.stopPropagation) e.stopImmediatePropagation();
          
          try {
            shortcut.callback(e);
          } catch (err) {
            console.error(`[ftl-ext-sdk] Shortcut "${id}" error:`, err);
          }
        }
      });
      
      listenerAttached = true;
    }

    /**
     * ui/toasts.js — Toast Notifications
     *
     * Creates a toast notification system that visually matches the site's
     * own Sonner toasts. Positioned bottom-center to match the site's
     * toast placement.
     *
     * We can't inject into Sonner's toaster because it doesn't render
     * its <ol> container until the first real toast is triggered. Instead
     * we create our own container with matching styling.
     */

    // Icon SVGs for toast types
    const ICONS = {
      default: `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="28" width="28" xmlns="http://www.w3.org/2000/svg"><path d="M256 56C145.72 56 56 145.72 56 256s89.72 200 200 200 200-89.72 200-200S366.28 56 256 56zm0 82a26 26 0 1 1-26 26 26 26 0 0 1 26-26zm48 226h-88a16 16 0 0 1 0-32h28v-88h-16a16 16 0 0 1 0-32h32a16 16 0 0 1 16 16v104h28a16 16 0 0 1 0 32z"></path></svg>`,
      success: `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="28" width="28" xmlns="http://www.w3.org/2000/svg"><path d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48zm108.25 138.29-134.4 160a16 16 0 0 1-12 5.71h-.27a16 16 0 0 1-11.89-5.3l-57.6-64a16 16 0 1 1 23.78-21.4l45.29 50.32 122.59-145.91a16 16 0 0 1 24.5 20.58z"></path></svg>`,
      error: `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="28" width="28" xmlns="http://www.w3.org/2000/svg"><path d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48zm75.31 260.69a16 16 0 1 1-22.62 22.62L256 278.63l-52.69 52.68a16 16 0 0 1-22.62-22.62L233.37 256l-52.68-52.69a16 16 0 0 1 22.62-22.62L256 233.37l52.69-52.68a16 16 0 0 1 22.62 22.62L278.63 256z"></path></svg>`,
      info: `<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="28" width="28" xmlns="http://www.w3.org/2000/svg"><path d="M256 56C145.72 56 56 145.72 56 256s89.72 200 200 200 200-89.72 200-200S366.28 56 256 56zm0 82a26 26 0 1 1-26 26 26 26 0 0 1 26-26zm48 226h-88a16 16 0 0 1 0-32h28v-88h-16a16 16 0 0 1 0-32h32a16 16 0 0 1 16 16v104h28a16 16 0 0 1 0 32z"></path></svg>`,
    };

    const ICON_COLOURS = {
      default: 'text-primary',
      success: 'text-green-500',
      error: 'text-red-500',
      info: 'text-primary',
    };

    let container = null;
    let styleInjected = false;

    /**
     * Inject animation styles.
     */
    function injectStyles$1() {
      if (styleInjected) return;
      const style = document.createElement('style');
      style.id = 'ftl-ext-toast-styles';
      style.textContent = `
    #ftl-ext-toasts {
      position: fixed;
      bottom: 96px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      flex-direction: column-reverse;
      align-items: center;
      gap: 8px;
      pointer-events: none;
    }
    @media (max-width: 1023px) {
      #ftl-ext-toasts {
        bottom: 64px;
      }
    }
    .ftl-ext-toast {
      pointer-events: auto;
      animation: ftl-ext-toast-in 0.3s ease forwards;
    }
    .ftl-ext-toast-out {
      animation: ftl-ext-toast-out 0.3s ease forwards;
    }
    @keyframes ftl-ext-toast-in {
      from { opacity: 0; transform: translateY(16px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes ftl-ext-toast-out {
      from { opacity: 1; transform: translateY(0) scale(1); }
      to { opacity: 0; transform: translateY(16px) scale(0.95); }
    }
  `;
      document.head.appendChild(style);
      styleInjected = true;
    }

    /**
     * Ensure the toast container exists.
     */
    function ensureContainer() {
      if (container && document.body.contains(container)) return;
      injectStyles$1();
      container = document.createElement('div');
      container.id = 'ftl-ext-toasts';
      document.body.appendChild(container);
    }

    /**
     * Show a toast notification.
     *
     * @param {string} title - Toast title
     * @param {Object} options
     * @param {string} options.description - Optional description text
     * @param {number} options.duration - Display duration in ms (default 5000)
     * @param {'default'|'success'|'error'|'info'} options.type - Toast style
     * @param {string} options.id - Optional ID (prevents duplicate toasts)
     * @returns {string} Toast ID
     */
    function notify(title, options = {}) {
      const {
        description = '',
        duration = 5000,
        type = 'default',
        id = `ftl-ext-${Date.now()}`,
      } = options;

      ensureContainer();

      // Prevent duplicates
      if (container.querySelector(`[data-ftl-toast-id="${id}"]`)) return id;

      const icon = ICONS[type] || ICONS.default;
      const iconColour = ICON_COLOURS[type] || ICON_COLOURS.default;

      const toast = document.createElement('div');
      toast.className = 'ftl-ext-toast';
      toast.setAttribute('data-ftl-toast-id', id);

      toast.innerHTML = `
    <div class="relative flex rounded-lg shadow-lg ring-1 items-center p-4 font-sans bg-light [background-image:var(--texture-panel)] ring-dark-300/95" style="width: 368px; max-width: calc(100vw - 32px);">
      <div class="flex items-start m-auto mr-2 drop-shadow-[1px_1px_0_#00000025] ${iconColour}">
        ${icon}
      </div>
      <div class="flex flex-1 items-center">
        <div class="w-full">
          <p class="text-lg font-medium leading-5 text-dark-text">${escapeHtml(title)}</p>
          ${description ? `<p class="mt-1 text-sm leading-4 text-dark-text-400">${escapeHtml(description)}</p>` : ''}
        </div>
      </div>
      <button class="absolute top-0 right-0 p-3 cursor-pointer z-1 text-dark-text/50 hover:text-dark-text" data-ftl-dismiss="${id}">
        <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M400 145.49 366.51 112 256 222.51 145.49 112 112 145.49 222.51 256 112 366.51 145.49 400 256 289.49 366.51 400 400 366.51 289.49 256 400 145.49z"></path></svg>
      </button>
    </div>
  `;

      // Dismiss on X click
      toast.querySelector(`[data-ftl-dismiss="${id}"]`)?.addEventListener('click', () => dismiss(id));

      container.appendChild(toast);

      // Auto-dismiss
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }

      return id;
    }

    /**
     * Dismiss a toast by ID.
     */
    function dismiss(id) {
      if (!container) return;

      const toast = container.querySelector(`[data-ftl-toast-id="${id}"]`);
      if (!toast) return;

      toast.classList.add('ftl-ext-toast-out');
      toast.classList.remove('ftl-ext-toast');
      setTimeout(() => toast.remove(), 300);
    }

    /**
     * Escape HTML to prevent XSS in toast content.
     */
    function escapeHtml(str) {
      const div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    /**
     * ui/toast-observer.js — Site Toast Observation
     * 
     * The new site uses Sonner (https://sonner.emilkowal.dev/) for toast
     * notifications. Toasts are <li> elements with data-sonner-toast attribute.
     * 
     * This module observes for new toasts appearing in the DOM and parses
     * their content — useful for logging admin messages, item notifications, etc.
     */


    const toastCallbacks = new Set();
    const processedToasts = new WeakSet();
    let disconnectObserver = null;

    /**
     * Parse a Sonner toast element into a structured object.
     * 
     * Toast structure:
     * <li data-sonner-toast>
     *   <div data-content>
     *     <div data-title>
     *       <div class="relative flex rounded-lg ...">
     *         [optional image div]
     *         <div class="flex flex-1 items-center">
     *           <p class="text-lg ...">Title</p>
     *           <p class="mt-1 text-sm ...">Description</p>
     *         </div>
     *       </div>
     *     </div>
     *   </div>
     * </li>
     * 
     * @param {HTMLElement} toastElement - A [data-sonner-toast] element
     * @returns {Object|null} Parsed toast or null
     */
    function parseToastElement(toastElement) {
      if (!toastElement || !toastElement.hasAttribute('data-sonner-toast')) {
        return null;
      }
      
      // Find the content paragraphs
      const paragraphs = toastElement.querySelectorAll('p');
      if (paragraphs.length === 0) return null;
      
      const title = paragraphs[0]?.textContent?.trim() || null;
      const description = paragraphs.length > 1
        ? paragraphs[1]?.textContent?.trim() || null
        : null;
      
      // Check for an image (item notifications have one)
      const img = toastElement.querySelector('img');
      const imageUrl = img ? extractImageUrl(img) : null;
      const imageAlt = img?.getAttribute('alt') || null;
      
      // Extract position info
      const yPosition = toastElement.getAttribute('data-y-position') || null;
      const xPosition = toastElement.getAttribute('data-x-position') || null;
      
      return {
        title,
        description,
        imageUrl,
        imageAlt,
        position: { x: xPosition, y: yPosition },
        timestamp: Date.now(),
        element: toastElement,
      };
    }

    /**
     * Extract image URL, handling Next.js image optimization.
     */
    function extractImageUrl(imgElement) {
      const src = imgElement?.getAttribute('src') || '';
      
      if (src.includes('/_next/image')) {
        try {
          const urlParam = new URL(src, window.location.origin).searchParams.get('url');
          return urlParam ? decodeURIComponent(urlParam) : src;
        } catch {
          const match = src.match(/url=([^&]+)/);
          return match ? decodeURIComponent(match[1]) : src;
        }
      }
      
      return src || null;
    }

    /**
     * Register a callback for new site toast notifications.
     * 
     * The callback receives a parsed toast object:
     * {
     *   title: string,           // e.g. "You found an item!"
     *   description: string,     // e.g. "Tip Jar was added to your inventory."
     *   imageUrl: string|null,   // CDN URL if toast has an image
     *   imageAlt: string|null,   // Image alt text (often the item name)
     *   position: { x, y },     // Toast position
     *   timestamp: number,       // When we observed it (Date.now())
     *   element: HTMLElement,    // Raw DOM element
     * }
     * 
     * @param {Function} callback - Called with the parsed toast
     * @returns {Function} Unsubscribe function
     */
    function onToast(callback) {
      toastCallbacks.add(callback);
      return () => toastCallbacks.delete(callback);
    }

    /**
     * Start observing for site toast notifications.
     * 
     * Targets the Sonner container element specifically, NOT document.body.
     * This is efficient because the container only mutates when toasts
     * are added or removed — it's completely isolated from chat and other
     * high-frequency DOM changes.
     * 
     * @returns {boolean} True if observation started successfully
     */
    function startObserving() {
      if (disconnectObserver) return true;
      
      const container = document.querySelector(SELECTORS.TOAST_CONTAINER);
      if (!container) {
        console.warn('[ftl-ext-sdk] Sonner toast container not found — cannot start observing');
        return false;
      }
      
      // Process any existing toasts
      container.querySelectorAll('[data-sonner-toast]').forEach(processToast);
      
      // Watch the Sonner container for new toast elements
      disconnectObserver = observe(container, (mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== 1) continue;
            
            // Check if the added node is a toast
            if (node.hasAttribute?.('data-sonner-toast')) {
              processToast(node);
            }
            
            // Check children (toast <li> inside a new <ol>)
            if (node.querySelectorAll) {
              node.querySelectorAll('[data-sonner-toast]').forEach(processToast);
            }
          }
        }
      }, { childList: true, subtree: true });
      
      console.log('[ftl-ext-sdk] Toast observer started (targeting Sonner container)');
      return true;
    }

    /**
     * Wait for the Sonner toast container to appear, then start observing.
     * 
     * The Sonner container appears a few seconds after page load.
     * This uses a short-lived body-level observer to find it, then
     * disconnects and switches to the targeted container observer.
     * 
     * @param {number} timeout - Max wait time in ms (default 30000)
     * @returns {Promise<boolean>} True if observation started successfully
     */
    async function waitAndObserve(timeout = 30000) {
      if (disconnectObserver) return true;
      
      // Try immediately first
      if (startObserving()) return true;
      
      // Wait for the Sonner container to appear
      try {
        await waitForElement(SELECTORS.TOAST_CONTAINER, timeout);
        return startObserving();
      } catch {
        console.warn('[ftl-ext-sdk] Toast container did not appear within', timeout, 'ms');
        return false;
      }
    }

    /**
     * Process a single toast element.
     */
    function processToast(element) {
      // Skip if already processed
      if (processedToasts.has(element)) return;
      processedToasts.add(element);
      
      const parsed = parseToastElement(element);
      if (!parsed) return;
      
      for (const cb of toastCallbacks) {
        try {
          cb(parsed);
        } catch (e) {
          console.error('[ftl-ext-sdk] Toast observer callback error:', e);
        }
      }
    }

    const PACKET_TYPES = Object.create(null); // no Map = no polyfill
    PACKET_TYPES["open"] = "0";
    PACKET_TYPES["close"] = "1";
    PACKET_TYPES["ping"] = "2";
    PACKET_TYPES["pong"] = "3";
    PACKET_TYPES["message"] = "4";
    PACKET_TYPES["upgrade"] = "5";
    PACKET_TYPES["noop"] = "6";
    const PACKET_TYPES_REVERSE = Object.create(null);
    Object.keys(PACKET_TYPES).forEach((key) => {
        PACKET_TYPES_REVERSE[PACKET_TYPES[key]] = key;
    });
    const ERROR_PACKET = { type: "error", data: "parser error" };

    const withNativeBlob$1 = typeof Blob === "function" ||
        (typeof Blob !== "undefined" &&
            Object.prototype.toString.call(Blob) === "[object BlobConstructor]");
    const withNativeArrayBuffer$2 = typeof ArrayBuffer === "function";
    // ArrayBuffer.isView method is not defined in IE10
    const isView$1 = (obj) => {
        return typeof ArrayBuffer.isView === "function"
            ? ArrayBuffer.isView(obj)
            : obj && obj.buffer instanceof ArrayBuffer;
    };
    const encodePacket = ({ type, data }, supportsBinary, callback) => {
        if (withNativeBlob$1 && data instanceof Blob) {
            if (supportsBinary) {
                return callback(data);
            }
            else {
                return encodeBlobAsBase64(data, callback);
            }
        }
        else if (withNativeArrayBuffer$2 &&
            (data instanceof ArrayBuffer || isView$1(data))) {
            if (supportsBinary) {
                return callback(data);
            }
            else {
                return encodeBlobAsBase64(new Blob([data]), callback);
            }
        }
        // plain string
        return callback(PACKET_TYPES[type] + (data || ""));
    };
    const encodeBlobAsBase64 = (data, callback) => {
        const fileReader = new FileReader();
        fileReader.onload = function () {
            const content = fileReader.result.split(",")[1];
            callback("b" + (content || ""));
        };
        return fileReader.readAsDataURL(data);
    };
    function toArray(data) {
        if (data instanceof Uint8Array) {
            return data;
        }
        else if (data instanceof ArrayBuffer) {
            return new Uint8Array(data);
        }
        else {
            return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        }
    }
    let TEXT_ENCODER;
    function encodePacketToBinary(packet, callback) {
        if (withNativeBlob$1 && packet.data instanceof Blob) {
            return packet.data.arrayBuffer().then(toArray).then(callback);
        }
        else if (withNativeArrayBuffer$2 &&
            (packet.data instanceof ArrayBuffer || isView$1(packet.data))) {
            return callback(toArray(packet.data));
        }
        encodePacket(packet, false, (encoded) => {
            if (!TEXT_ENCODER) {
                TEXT_ENCODER = new TextEncoder();
            }
            callback(TEXT_ENCODER.encode(encoded));
        });
    }

    // imported from https://github.com/socketio/base64-arraybuffer
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    // Use a lookup table to find the index.
    const lookup$1 = typeof Uint8Array === 'undefined' ? [] : new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) {
        lookup$1[chars.charCodeAt(i)] = i;
    }
    const decode$1 = (base64) => {
        let bufferLength = base64.length * 0.75, len = base64.length, i, p = 0, encoded1, encoded2, encoded3, encoded4;
        if (base64[base64.length - 1] === '=') {
            bufferLength--;
            if (base64[base64.length - 2] === '=') {
                bufferLength--;
            }
        }
        const arraybuffer = new ArrayBuffer(bufferLength), bytes = new Uint8Array(arraybuffer);
        for (i = 0; i < len; i += 4) {
            encoded1 = lookup$1[base64.charCodeAt(i)];
            encoded2 = lookup$1[base64.charCodeAt(i + 1)];
            encoded3 = lookup$1[base64.charCodeAt(i + 2)];
            encoded4 = lookup$1[base64.charCodeAt(i + 3)];
            bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
            bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
            bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
        }
        return arraybuffer;
    };

    const withNativeArrayBuffer$1 = typeof ArrayBuffer === "function";
    const decodePacket = (encodedPacket, binaryType) => {
        if (typeof encodedPacket !== "string") {
            return {
                type: "message",
                data: mapBinary(encodedPacket, binaryType),
            };
        }
        const type = encodedPacket.charAt(0);
        if (type === "b") {
            return {
                type: "message",
                data: decodeBase64Packet(encodedPacket.substring(1), binaryType),
            };
        }
        const packetType = PACKET_TYPES_REVERSE[type];
        if (!packetType) {
            return ERROR_PACKET;
        }
        return encodedPacket.length > 1
            ? {
                type: PACKET_TYPES_REVERSE[type],
                data: encodedPacket.substring(1),
            }
            : {
                type: PACKET_TYPES_REVERSE[type],
            };
    };
    const decodeBase64Packet = (data, binaryType) => {
        if (withNativeArrayBuffer$1) {
            const decoded = decode$1(data);
            return mapBinary(decoded, binaryType);
        }
        else {
            return { base64: true, data }; // fallback for old browsers
        }
    };
    const mapBinary = (data, binaryType) => {
        switch (binaryType) {
            case "blob":
                if (data instanceof Blob) {
                    // from WebSocket + binaryType "blob"
                    return data;
                }
                else {
                    // from HTTP long-polling or WebTransport
                    return new Blob([data]);
                }
            case "arraybuffer":
            default:
                if (data instanceof ArrayBuffer || Object.prototype.toString.call(data) === "[object ArrayBuffer]") {
                // from HTTP long-polling (base64) or WebSocket + binaryType "arraybuffer" (patched for Firefox)
                    return data;
                }
                else {
                    // from WebTransport (Uint8Array)
                    return data.buffer;
                }
        }
    };

    const SEPARATOR = String.fromCharCode(30); // see https://en.wikipedia.org/wiki/Delimiter#ASCII_delimited_text
    const encodePayload = (packets, callback) => {
        // some packets may be added to the array while encoding, so the initial length must be saved
        const length = packets.length;
        const encodedPackets = new Array(length);
        let count = 0;
        packets.forEach((packet, i) => {
            // force base64 encoding for binary packets
            encodePacket(packet, false, (encodedPacket) => {
                encodedPackets[i] = encodedPacket;
                if (++count === length) {
                    callback(encodedPackets.join(SEPARATOR));
                }
            });
        });
    };
    const decodePayload = (encodedPayload, binaryType) => {
        const encodedPackets = encodedPayload.split(SEPARATOR);
        const packets = [];
        for (let i = 0; i < encodedPackets.length; i++) {
            const decodedPacket = decodePacket(encodedPackets[i], binaryType);
            packets.push(decodedPacket);
            if (decodedPacket.type === "error") {
                break;
            }
        }
        return packets;
    };
    function createPacketEncoderStream() {
        return new TransformStream({
            transform(packet, controller) {
                encodePacketToBinary(packet, (encodedPacket) => {
                    const payloadLength = encodedPacket.length;
                    let header;
                    // inspired by the WebSocket format: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#decoding_payload_length
                    if (payloadLength < 126) {
                        header = new Uint8Array(1);
                        new DataView(header.buffer).setUint8(0, payloadLength);
                    }
                    else if (payloadLength < 65536) {
                        header = new Uint8Array(3);
                        const view = new DataView(header.buffer);
                        view.setUint8(0, 126);
                        view.setUint16(1, payloadLength);
                    }
                    else {
                        header = new Uint8Array(9);
                        const view = new DataView(header.buffer);
                        view.setUint8(0, 127);
                        view.setBigUint64(1, BigInt(payloadLength));
                    }
                    // first bit indicates whether the payload is plain text (0) or binary (1)
                    if (packet.data && typeof packet.data !== "string") {
                        header[0] |= 0x80;
                    }
                    controller.enqueue(header);
                    controller.enqueue(encodedPacket);
                });
            },
        });
    }
    let TEXT_DECODER;
    function totalLength(chunks) {
        return chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    }
    function concatChunks(chunks, size) {
        if (chunks[0].length === size) {
            return chunks.shift();
        }
        const buffer = new Uint8Array(size);
        let j = 0;
        for (let i = 0; i < size; i++) {
            buffer[i] = chunks[0][j++];
            if (j === chunks[0].length) {
                chunks.shift();
                j = 0;
            }
        }
        if (chunks.length && j < chunks[0].length) {
            chunks[0] = chunks[0].slice(j);
        }
        return buffer;
    }
    function createPacketDecoderStream(maxPayload, binaryType) {
        if (!TEXT_DECODER) {
            TEXT_DECODER = new TextDecoder();
        }
        const chunks = [];
        let state = 0 /* State.READ_HEADER */;
        let expectedLength = -1;
        let isBinary = false;
        return new TransformStream({
            transform(chunk, controller) {
                chunks.push(chunk);
                while (true) {
                    if (state === 0 /* State.READ_HEADER */) {
                        if (totalLength(chunks) < 1) {
                            break;
                        }
                        const header = concatChunks(chunks, 1);
                        isBinary = (header[0] & 0x80) === 0x80;
                        expectedLength = header[0] & 0x7f;
                        if (expectedLength < 126) {
                            state = 3 /* State.READ_PAYLOAD */;
                        }
                        else if (expectedLength === 126) {
                            state = 1 /* State.READ_EXTENDED_LENGTH_16 */;
                        }
                        else {
                            state = 2 /* State.READ_EXTENDED_LENGTH_64 */;
                        }
                    }
                    else if (state === 1 /* State.READ_EXTENDED_LENGTH_16 */) {
                        if (totalLength(chunks) < 2) {
                            break;
                        }
                        const headerArray = concatChunks(chunks, 2);
                        expectedLength = new DataView(headerArray.buffer, headerArray.byteOffset, headerArray.length).getUint16(0);
                        state = 3 /* State.READ_PAYLOAD */;
                    }
                    else if (state === 2 /* State.READ_EXTENDED_LENGTH_64 */) {
                        if (totalLength(chunks) < 8) {
                            break;
                        }
                        const headerArray = concatChunks(chunks, 8);
                        const view = new DataView(headerArray.buffer, headerArray.byteOffset, headerArray.length);
                        const n = view.getUint32(0);
                        if (n > Math.pow(2, 53 - 32) - 1) {
                            // the maximum safe integer in JavaScript is 2^53 - 1
                            controller.enqueue(ERROR_PACKET);
                            break;
                        }
                        expectedLength = n * Math.pow(2, 32) + view.getUint32(4);
                        state = 3 /* State.READ_PAYLOAD */;
                    }
                    else {
                        if (totalLength(chunks) < expectedLength) {
                            break;
                        }
                        const data = concatChunks(chunks, expectedLength);
                        controller.enqueue(decodePacket(isBinary ? data : TEXT_DECODER.decode(data), binaryType));
                        state = 0 /* State.READ_HEADER */;
                    }
                    if (expectedLength === 0 || expectedLength > maxPayload) {
                        controller.enqueue(ERROR_PACKET);
                        break;
                    }
                }
            },
        });
    }
    const protocol = 4;

    /**
     * Initialize a new `Emitter`.
     *
     * @api public
     */

    function Emitter(obj) {
      if (obj) return mixin(obj);
    }

    /**
     * Mixin the emitter properties.
     *
     * @param {Object} obj
     * @return {Object}
     * @api private
     */

    function mixin(obj) {
      for (var key in Emitter.prototype) {
        obj[key] = Emitter.prototype[key];
      }
      return obj;
    }

    /**
     * Listen on the given `event` with `fn`.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.on =
    Emitter.prototype.addEventListener = function(event, fn){
      this._callbacks = this._callbacks || {};
      (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
        .push(fn);
      return this;
    };

    /**
     * Adds an `event` listener that will be invoked a single
     * time then automatically removed.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.once = function(event, fn){
      function on() {
        this.off(event, on);
        fn.apply(this, arguments);
      }

      on.fn = fn;
      this.on(event, on);
      return this;
    };

    /**
     * Remove the given callback for `event` or all
     * registered callbacks.
     *
     * @param {String} event
     * @param {Function} fn
     * @return {Emitter}
     * @api public
     */

    Emitter.prototype.off =
    Emitter.prototype.removeListener =
    Emitter.prototype.removeAllListeners =
    Emitter.prototype.removeEventListener = function(event, fn){
      this._callbacks = this._callbacks || {};

      // all
      if (0 == arguments.length) {
        this._callbacks = {};
        return this;
      }

      // specific event
      var callbacks = this._callbacks['$' + event];
      if (!callbacks) return this;

      // remove all handlers
      if (1 == arguments.length) {
        delete this._callbacks['$' + event];
        return this;
      }

      // remove specific handler
      var cb;
      for (var i = 0; i < callbacks.length; i++) {
        cb = callbacks[i];
        if (cb === fn || cb.fn === fn) {
          callbacks.splice(i, 1);
          break;
        }
      }

      // Remove event specific arrays for event types that no
      // one is subscribed for to avoid memory leak.
      if (callbacks.length === 0) {
        delete this._callbacks['$' + event];
      }

      return this;
    };

    /**
     * Emit `event` with the given args.
     *
     * @param {String} event
     * @param {Mixed} ...
     * @return {Emitter}
     */

    Emitter.prototype.emit = function(event){
      this._callbacks = this._callbacks || {};

      var args = new Array(arguments.length - 1)
        , callbacks = this._callbacks['$' + event];

      for (var i = 1; i < arguments.length; i++) {
        args[i - 1] = arguments[i];
      }

      if (callbacks) {
        callbacks = callbacks.slice(0);
        for (var i = 0, len = callbacks.length; i < len; ++i) {
          callbacks[i].apply(this, args);
        }
      }

      return this;
    };

    // alias used for reserved events (protected method)
    Emitter.prototype.emitReserved = Emitter.prototype.emit;

    /**
     * Return array of callbacks for `event`.
     *
     * @param {String} event
     * @return {Array}
     * @api public
     */

    Emitter.prototype.listeners = function(event){
      this._callbacks = this._callbacks || {};
      return this._callbacks['$' + event] || [];
    };

    /**
     * Check if this emitter has `event` handlers.
     *
     * @param {String} event
     * @return {Boolean}
     * @api public
     */

    Emitter.prototype.hasListeners = function(event){
      return !! this.listeners(event).length;
    };

    const nextTick = (() => {
        const isPromiseAvailable = typeof Promise === "function" && typeof Promise.resolve === "function";
        if (isPromiseAvailable) {
            return (cb) => Promise.resolve().then(cb);
        }
        else {
            return (cb, setTimeoutFn) => setTimeoutFn(cb, 0);
        }
    })();
    const globalThisShim = (() => {
        if (typeof self !== "undefined") {
            return self;
        }
        else if (typeof window !== "undefined") {
            return window;
        }
        else {
            return Function("return this")();
        }
    })();
    const defaultBinaryType = "arraybuffer";
    function createCookieJar() { }

    function pick(obj, ...attr) {
        return attr.reduce((acc, k) => {
            if (obj.hasOwnProperty(k)) {
                acc[k] = obj[k];
            }
            return acc;
        }, {});
    }
    // Keep a reference to the real timeout functions so they can be used when overridden
    const NATIVE_SET_TIMEOUT = globalThisShim.setTimeout;
    const NATIVE_CLEAR_TIMEOUT = globalThisShim.clearTimeout;
    function installTimerFunctions(obj, opts) {
        if (opts.useNativeTimers) {
            obj.setTimeoutFn = NATIVE_SET_TIMEOUT.bind(globalThisShim);
            obj.clearTimeoutFn = NATIVE_CLEAR_TIMEOUT.bind(globalThisShim);
        }
        else {
            obj.setTimeoutFn = globalThisShim.setTimeout.bind(globalThisShim);
            obj.clearTimeoutFn = globalThisShim.clearTimeout.bind(globalThisShim);
        }
    }
    // base64 encoded buffers are about 33% bigger (https://en.wikipedia.org/wiki/Base64)
    const BASE64_OVERHEAD = 1.33;
    // we could also have used `new Blob([obj]).size`, but it isn't supported in IE9
    function byteLength(obj) {
        if (typeof obj === "string") {
            return utf8Length(obj);
        }
        // arraybuffer or blob
        return Math.ceil((obj.byteLength || obj.size) * BASE64_OVERHEAD);
    }
    function utf8Length(str) {
        let c = 0, length = 0;
        for (let i = 0, l = str.length; i < l; i++) {
            c = str.charCodeAt(i);
            if (c < 0x80) {
                length += 1;
            }
            else if (c < 0x800) {
                length += 2;
            }
            else if (c < 0xd800 || c >= 0xe000) {
                length += 3;
            }
            else {
                i++;
                length += 4;
            }
        }
        return length;
    }
    /**
     * Generates a random 8-characters string.
     */
    function randomString() {
        return (Date.now().toString(36).substring(3) +
            Math.random().toString(36).substring(2, 5));
    }

    // imported from https://github.com/galkn/querystring
    /**
     * Compiles a querystring
     * Returns string representation of the object
     *
     * @param {Object}
     * @api private
     */
    function encode(obj) {
        let str = '';
        for (let i in obj) {
            if (obj.hasOwnProperty(i)) {
                if (str.length)
                    str += '&';
                str += encodeURIComponent(i) + '=' + encodeURIComponent(obj[i]);
            }
        }
        return str;
    }
    /**
     * Parses a simple querystring into an object
     *
     * @param {String} qs
     * @api private
     */
    function decode(qs) {
        let qry = {};
        let pairs = qs.split('&');
        for (let i = 0, l = pairs.length; i < l; i++) {
            let pair = pairs[i].split('=');
            qry[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
        }
        return qry;
    }

    class TransportError extends Error {
        constructor(reason, description, context) {
            super(reason);
            this.description = description;
            this.context = context;
            this.type = "TransportError";
        }
    }
    class Transport extends Emitter {
        /**
         * Transport abstract constructor.
         *
         * @param {Object} opts - options
         * @protected
         */
        constructor(opts) {
            super();
            this.writable = false;
            installTimerFunctions(this, opts);
            this.opts = opts;
            this.query = opts.query;
            this.socket = opts.socket;
            this.supportsBinary = !opts.forceBase64;
        }
        /**
         * Emits an error.
         *
         * @param {String} reason
         * @param description
         * @param context - the error context
         * @return {Transport} for chaining
         * @protected
         */
        onError(reason, description, context) {
            super.emitReserved("error", new TransportError(reason, description, context));
            return this;
        }
        /**
         * Opens the transport.
         */
        open() {
            this.readyState = "opening";
            this.doOpen();
            return this;
        }
        /**
         * Closes the transport.
         */
        close() {
            if (this.readyState === "opening" || this.readyState === "open") {
                this.doClose();
                this.onClose();
            }
            return this;
        }
        /**
         * Sends multiple packets.
         *
         * @param {Array} packets
         */
        send(packets) {
            if (this.readyState === "open") {
                this.write(packets);
            }
        }
        /**
         * Called upon open
         *
         * @protected
         */
        onOpen() {
            this.readyState = "open";
            this.writable = true;
            super.emitReserved("open");
        }
        /**
         * Called with data.
         *
         * @param {String} data
         * @protected
         */
        onData(data) {
            const packet = decodePacket(data, this.socket.binaryType);
            this.onPacket(packet);
        }
        /**
         * Called with a decoded packet.
         *
         * @protected
         */
        onPacket(packet) {
            super.emitReserved("packet", packet);
        }
        /**
         * Called upon close.
         *
         * @protected
         */
        onClose(details) {
            this.readyState = "closed";
            super.emitReserved("close", details);
        }
        /**
         * Pauses the transport, in order not to lose packets during an upgrade.
         *
         * @param onPause
         */
        pause(onPause) { }
        createUri(schema, query = {}) {
            return (schema +
                "://" +
                this._hostname() +
                this._port() +
                this.opts.path +
                this._query(query));
        }
        _hostname() {
            const hostname = this.opts.hostname;
            return hostname.indexOf(":") === -1 ? hostname : "[" + hostname + "]";
        }
        _port() {
            if (this.opts.port &&
                ((this.opts.secure && Number(this.opts.port) !== 443) ||
                    (!this.opts.secure && Number(this.opts.port) !== 80))) {
                return ":" + this.opts.port;
            }
            else {
                return "";
            }
        }
        _query(query) {
            const encodedQuery = encode(query);
            return encodedQuery.length ? "?" + encodedQuery : "";
        }
    }

    class Polling extends Transport {
        constructor() {
            super(...arguments);
            this._polling = false;
        }
        get name() {
            return "polling";
        }
        /**
         * Opens the socket (triggers polling). We write a PING message to determine
         * when the transport is open.
         *
         * @protected
         */
        doOpen() {
            this._poll();
        }
        /**
         * Pauses polling.
         *
         * @param {Function} onPause - callback upon buffers are flushed and transport is paused
         * @package
         */
        pause(onPause) {
            this.readyState = "pausing";
            const pause = () => {
                this.readyState = "paused";
                onPause();
            };
            if (this._polling || !this.writable) {
                let total = 0;
                if (this._polling) {
                    total++;
                    this.once("pollComplete", function () {
                        --total || pause();
                    });
                }
                if (!this.writable) {
                    total++;
                    this.once("drain", function () {
                        --total || pause();
                    });
                }
            }
            else {
                pause();
            }
        }
        /**
         * Starts polling cycle.
         *
         * @private
         */
        _poll() {
            this._polling = true;
            this.doPoll();
            this.emitReserved("poll");
        }
        /**
         * Overloads onData to detect payloads.
         *
         * @protected
         */
        onData(data) {
            const callback = (packet) => {
                // if its the first message we consider the transport open
                if ("opening" === this.readyState && packet.type === "open") {
                    this.onOpen();
                }
                // if its a close packet, we close the ongoing requests
                if ("close" === packet.type) {
                    this.onClose({ description: "transport closed by the server" });
                    return false;
                }
                // otherwise bypass onData and handle the message
                this.onPacket(packet);
            };
            // decode payload
            decodePayload(data, this.socket.binaryType).forEach(callback);
            // if an event did not trigger closing
            if ("closed" !== this.readyState) {
                // if we got data we're not polling
                this._polling = false;
                this.emitReserved("pollComplete");
                if ("open" === this.readyState) {
                    this._poll();
                }
            }
        }
        /**
         * For polling, send a close packet.
         *
         * @protected
         */
        doClose() {
            const close = () => {
                this.write([{ type: "close" }]);
            };
            if ("open" === this.readyState) {
                close();
            }
            else {
                // in case we're trying to close while
                // handshaking is in progress (GH-164)
                this.once("open", close);
            }
        }
        /**
         * Writes a packets payload.
         *
         * @param {Array} packets - data packets
         * @protected
         */
        write(packets) {
            this.writable = false;
            encodePayload(packets, (data) => {
                this.doWrite(data, () => {
                    this.writable = true;
                    this.emitReserved("drain");
                });
            });
        }
        /**
         * Generates uri for connection.
         *
         * @private
         */
        uri() {
            const schema = this.opts.secure ? "https" : "http";
            const query = this.query || {};
            // cache busting is forced
            if (false !== this.opts.timestampRequests) {
                query[this.opts.timestampParam] = randomString();
            }
            if (!this.supportsBinary && !query.sid) {
                query.b64 = 1;
            }
            return this.createUri(schema, query);
        }
    }

    // imported from https://github.com/component/has-cors
    let value = false;
    try {
        value = typeof XMLHttpRequest !== 'undefined' &&
            'withCredentials' in new XMLHttpRequest();
    }
    catch (err) {
        // if XMLHttp support is disabled in IE then it will throw
        // when trying to create
    }
    const hasCORS = value;

    function empty() { }
    class BaseXHR extends Polling {
        /**
         * XHR Polling constructor.
         *
         * @param {Object} opts
         * @package
         */
        constructor(opts) {
            super(opts);
            if (typeof location !== "undefined") {
                const isSSL = "https:" === location.protocol;
                let port = location.port;
                // some user agents have empty `location.port`
                if (!port) {
                    port = isSSL ? "443" : "80";
                }
                this.xd =
                    (typeof location !== "undefined" &&
                        opts.hostname !== location.hostname) ||
                        port !== opts.port;
            }
        }
        /**
         * Sends data.
         *
         * @param {String} data to send.
         * @param {Function} called upon flush.
         * @private
         */
        doWrite(data, fn) {
            const req = this.request({
                method: "POST",
                data: data,
            });
            req.on("success", fn);
            req.on("error", (xhrStatus, context) => {
                this.onError("xhr post error", xhrStatus, context);
            });
        }
        /**
         * Starts a poll cycle.
         *
         * @private
         */
        doPoll() {
            const req = this.request();
            req.on("data", this.onData.bind(this));
            req.on("error", (xhrStatus, context) => {
                this.onError("xhr poll error", xhrStatus, context);
            });
            this.pollXhr = req;
        }
    }
    class Request extends Emitter {
        /**
         * Request constructor
         *
         * @param {Object} options
         * @package
         */
        constructor(createRequest, uri, opts) {
            super();
            this.createRequest = createRequest;
            installTimerFunctions(this, opts);
            this._opts = opts;
            this._method = opts.method || "GET";
            this._uri = uri;
            this._data = undefined !== opts.data ? opts.data : null;
            this._create();
        }
        /**
         * Creates the XHR object and sends the request.
         *
         * @private
         */
        _create() {
            var _a;
            const opts = pick(this._opts, "agent", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "autoUnref");
            opts.xdomain = !!this._opts.xd;
            const xhr = (this._xhr = this.createRequest(opts));
            try {
                xhr.open(this._method, this._uri, true);
                try {
                    if (this._opts.extraHeaders) {
                        // @ts-ignore
                        xhr.setDisableHeaderCheck && xhr.setDisableHeaderCheck(true);
                        for (let i in this._opts.extraHeaders) {
                            if (this._opts.extraHeaders.hasOwnProperty(i)) {
                                xhr.setRequestHeader(i, this._opts.extraHeaders[i]);
                            }
                        }
                    }
                }
                catch (e) { }
                if ("POST" === this._method) {
                    try {
                        xhr.setRequestHeader("Content-type", "text/plain;charset=UTF-8");
                    }
                    catch (e) { }
                }
                try {
                    xhr.setRequestHeader("Accept", "*/*");
                }
                catch (e) { }
                (_a = this._opts.cookieJar) === null || _a === void 0 ? void 0 : _a.addCookies(xhr);
                // ie6 check
                if ("withCredentials" in xhr) {
                    xhr.withCredentials = this._opts.withCredentials;
                }
                if (this._opts.requestTimeout) {
                    xhr.timeout = this._opts.requestTimeout;
                }
                xhr.onreadystatechange = () => {
                    var _a;
                    if (xhr.readyState === 3) {
                        (_a = this._opts.cookieJar) === null || _a === void 0 ? void 0 : _a.parseCookies(
                        // @ts-ignore
                        xhr.getResponseHeader("set-cookie"));
                    }
                    if (4 !== xhr.readyState)
                        return;
                    if (200 === xhr.status || 1223 === xhr.status) {
                        this._onLoad();
                    }
                    else {
                        // make sure the `error` event handler that's user-set
                        // does not throw in the same tick and gets caught here
                        this.setTimeoutFn(() => {
                            this._onError(typeof xhr.status === "number" ? xhr.status : 0);
                        }, 0);
                    }
                };
                xhr.send(this._data);
            }
            catch (e) {
                // Need to defer since .create() is called directly from the constructor
                // and thus the 'error' event can only be only bound *after* this exception
                // occurs.  Therefore, also, we cannot throw here at all.
                this.setTimeoutFn(() => {
                    this._onError(e);
                }, 0);
                return;
            }
            if (typeof document !== "undefined") {
                this._index = Request.requestsCount++;
                Request.requests[this._index] = this;
            }
        }
        /**
         * Called upon error.
         *
         * @private
         */
        _onError(err) {
            this.emitReserved("error", err, this._xhr);
            this._cleanup(true);
        }
        /**
         * Cleans up house.
         *
         * @private
         */
        _cleanup(fromError) {
            if ("undefined" === typeof this._xhr || null === this._xhr) {
                return;
            }
            this._xhr.onreadystatechange = empty;
            if (fromError) {
                try {
                    this._xhr.abort();
                }
                catch (e) { }
            }
            if (typeof document !== "undefined") {
                delete Request.requests[this._index];
            }
            this._xhr = null;
        }
        /**
         * Called upon load.
         *
         * @private
         */
        _onLoad() {
            const data = this._xhr.responseText;
            if (data !== null) {
                this.emitReserved("data", data);
                this.emitReserved("success");
                this._cleanup();
            }
        }
        /**
         * Aborts the request.
         *
         * @package
         */
        abort() {
            this._cleanup();
        }
    }
    Request.requestsCount = 0;
    Request.requests = {};
    /**
     * Aborts pending requests when unloading the window. This is needed to prevent
     * memory leaks (e.g. when using IE) and to ensure that no spurious error is
     * emitted.
     */
    if (typeof document !== "undefined") {
        // @ts-ignore
        if (typeof attachEvent === "function") {
            // @ts-ignore
            attachEvent("onunload", unloadHandler);
        }
        else if (typeof addEventListener === "function") {
            const terminationEvent = "onpagehide" in globalThisShim ? "pagehide" : "unload";
            addEventListener(terminationEvent, unloadHandler, false);
        }
    }
    function unloadHandler() {
        for (let i in Request.requests) {
            if (Request.requests.hasOwnProperty(i)) {
                Request.requests[i].abort();
            }
        }
    }
    const hasXHR2 = (function () {
        const xhr = newRequest({
            xdomain: false,
        });
        return xhr && xhr.responseType !== null;
    })();
    /**
     * HTTP long-polling based on the built-in `XMLHttpRequest` object.
     *
     * Usage: browser
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
     */
    class XHR extends BaseXHR {
        constructor(opts) {
            super(opts);
            const forceBase64 = opts && opts.forceBase64;
            this.supportsBinary = hasXHR2 && !forceBase64;
        }
        request(opts = {}) {
            Object.assign(opts, { xd: this.xd }, this.opts);
            return new Request(newRequest, this.uri(), opts);
        }
    }
    function newRequest(opts) {
        const xdomain = opts.xdomain;
        // XMLHttpRequest can be disabled on IE
        try {
            if ("undefined" !== typeof XMLHttpRequest && (!xdomain || hasCORS)) {
                return new XMLHttpRequest();
            }
        }
        catch (e) { }
        if (!xdomain) {
            try {
                return new globalThisShim[["Active"].concat("Object").join("X")]("Microsoft.XMLHTTP");
            }
            catch (e) { }
        }
    }

    // detect ReactNative environment
    const isReactNative = typeof navigator !== "undefined" &&
        typeof navigator.product === "string" &&
        navigator.product.toLowerCase() === "reactnative";
    class BaseWS extends Transport {
        get name() {
            return "websocket";
        }
        doOpen() {
            const uri = this.uri();
            const protocols = this.opts.protocols;
            // React Native only supports the 'headers' option, and will print a warning if anything else is passed
            const opts = isReactNative
                ? {}
                : pick(this.opts, "agent", "perMessageDeflate", "pfx", "key", "passphrase", "cert", "ca", "ciphers", "rejectUnauthorized", "localAddress", "protocolVersion", "origin", "maxPayload", "family", "checkServerIdentity");
            if (this.opts.extraHeaders) {
                opts.headers = this.opts.extraHeaders;
            }
            try {
                this.ws = this.createSocket(uri, protocols, opts);
            }
            catch (err) {
                return this.emitReserved("error", err);
            }
            this.ws.binaryType = this.socket.binaryType;
            this.addEventListeners();
        }
        /**
         * Adds event listeners to the socket
         *
         * @private
         */
        addEventListeners() {
            this.ws.onopen = () => {
                if (this.opts.autoUnref) {
                    this.ws._socket.unref();
                }
                this.onOpen();
            };
            this.ws.onclose = (closeEvent) => this.onClose({
                description: "websocket connection closed",
                context: closeEvent,
            });
            this.ws.onmessage = (ev) => this.onData(ev.data);
            this.ws.onerror = (e) => this.onError("websocket error", e);
        }
        write(packets) {
            this.writable = false;
            // encodePacket efficient as it uses WS framing
            // no need for encodePayload
            for (let i = 0; i < packets.length; i++) {
                const packet = packets[i];
                const lastPacket = i === packets.length - 1;
                encodePacket(packet, this.supportsBinary, (data) => {
                    // Sometimes the websocket has already been closed but the browser didn't
                    // have a chance of informing us about it yet, in that case send will
                    // throw an error
                    try {
                        this.doWrite(packet, data);
                    }
                    catch (e) {
                    }
                    if (lastPacket) {
                        // fake drain
                        // defer to next tick to allow Socket to clear writeBuffer
                        nextTick(() => {
                            this.writable = true;
                            this.emitReserved("drain");
                        }, this.setTimeoutFn);
                    }
                });
            }
        }
        doClose() {
            if (typeof this.ws !== "undefined") {
                this.ws.onerror = () => { };
                this.ws.close();
                this.ws = null;
            }
        }
        /**
         * Generates uri for connection.
         *
         * @private
         */
        uri() {
            const schema = this.opts.secure ? "wss" : "ws";
            const query = this.query || {};
            // append timestamp to URI
            if (this.opts.timestampRequests) {
                query[this.opts.timestampParam] = randomString();
            }
            // communicate binary support capabilities
            if (!this.supportsBinary) {
                query.b64 = 1;
            }
            return this.createUri(schema, query);
        }
    }
    const WebSocketCtor = globalThisShim.WebSocket || globalThisShim.MozWebSocket;
    /**
     * WebSocket transport based on the built-in `WebSocket` object.
     *
     * Usage: browser, Node.js (since v21), Deno, Bun
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
     * @see https://caniuse.com/mdn-api_websocket
     * @see https://nodejs.org/api/globals.html#websocket
     */
    class WS extends BaseWS {
        createSocket(uri, protocols, opts) {
            return !isReactNative
                ? protocols
                    ? new WebSocketCtor(uri, protocols)
                    : new WebSocketCtor(uri)
                : new WebSocketCtor(uri, protocols, opts);
        }
        doWrite(_packet, data) {
            this.ws.send(data);
        }
    }

    /**
     * WebTransport transport based on the built-in `WebTransport` object.
     *
     * Usage: browser, Node.js (with the `@fails-components/webtransport` package)
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/API/WebTransport
     * @see https://caniuse.com/webtransport
     */
    class WT extends Transport {
        get name() {
            return "webtransport";
        }
        doOpen() {
            try {
                // @ts-ignore
                this._transport = new WebTransport(this.createUri("https"), this.opts.transportOptions[this.name]);
            }
            catch (err) {
                return this.emitReserved("error", err);
            }
            this._transport.closed
                .then(() => {
                this.onClose();
            })
                .catch((err) => {
                this.onError("webtransport error", err);
            });
            // note: we could have used async/await, but that would require some additional polyfills
            this._transport.ready.then(() => {
                this._transport.createBidirectionalStream().then((stream) => {
                    const decoderStream = createPacketDecoderStream(Number.MAX_SAFE_INTEGER, this.socket.binaryType);
                    const reader = stream.readable.pipeThrough(decoderStream).getReader();
                    const encoderStream = createPacketEncoderStream();
                    encoderStream.readable.pipeTo(stream.writable);
                    this._writer = encoderStream.writable.getWriter();
                    const read = () => {
                        reader
                            .read()
                            .then(({ done, value }) => {
                            if (done) {
                                return;
                            }
                            this.onPacket(value);
                            read();
                        })
                            .catch((err) => {
                        });
                    };
                    read();
                    const packet = { type: "open" };
                    if (this.query.sid) {
                        packet.data = `{"sid":"${this.query.sid}"}`;
                    }
                    this._writer.write(packet).then(() => this.onOpen());
                });
            });
        }
        write(packets) {
            this.writable = false;
            for (let i = 0; i < packets.length; i++) {
                const packet = packets[i];
                const lastPacket = i === packets.length - 1;
                this._writer.write(packet).then(() => {
                    if (lastPacket) {
                        nextTick(() => {
                            this.writable = true;
                            this.emitReserved("drain");
                        }, this.setTimeoutFn);
                    }
                });
            }
        }
        doClose() {
            var _a;
            (_a = this._transport) === null || _a === void 0 ? void 0 : _a.close();
        }
    }

    const transports = {
        websocket: WS,
        webtransport: WT,
        polling: XHR,
    };

    // imported from https://github.com/galkn/parseuri
    /**
     * Parses a URI
     *
     * Note: we could also have used the built-in URL object, but it isn't supported on all platforms.
     *
     * See:
     * - https://developer.mozilla.org/en-US/docs/Web/API/URL
     * - https://caniuse.com/url
     * - https://www.rfc-editor.org/rfc/rfc3986#appendix-B
     *
     * History of the parse() method:
     * - first commit: https://github.com/socketio/socket.io-client/commit/4ee1d5d94b3906a9c052b459f1a818b15f38f91c
     * - export into its own module: https://github.com/socketio/engine.io-client/commit/de2c561e4564efeb78f1bdb1ba39ef81b2822cb3
     * - reimport: https://github.com/socketio/engine.io-client/commit/df32277c3f6d622eec5ed09f493cae3f3391d242
     *
     * @author Steven Levithan <stevenlevithan.com> (MIT license)
     * @api private
     */
    const re = /^(?:(?![^:@\/?#]+:[^:@\/]*@)(http|https|ws|wss):\/\/)?((?:(([^:@\/?#]*)(?::([^:@\/?#]*))?)?@)?((?:[a-f0-9]{0,4}:){2,7}[a-f0-9]{0,4}|[^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/;
    const parts = [
        'source', 'protocol', 'authority', 'userInfo', 'user', 'password', 'host', 'port', 'relative', 'path', 'directory', 'file', 'query', 'anchor'
    ];
    function parse(str) {
        if (str.length > 8000) {
            throw "URI too long";
        }
        const src = str, b = str.indexOf('['), e = str.indexOf(']');
        if (b != -1 && e != -1) {
            str = str.substring(0, b) + str.substring(b, e).replace(/:/g, ';') + str.substring(e, str.length);
        }
        let m = re.exec(str || ''), uri = {}, i = 14;
        while (i--) {
            uri[parts[i]] = m[i] || '';
        }
        if (b != -1 && e != -1) {
            uri.source = src;
            uri.host = uri.host.substring(1, uri.host.length - 1).replace(/;/g, ':');
            uri.authority = uri.authority.replace('[', '').replace(']', '').replace(/;/g, ':');
            uri.ipv6uri = true;
        }
        uri.pathNames = pathNames(uri, uri['path']);
        uri.queryKey = queryKey(uri, uri['query']);
        return uri;
    }
    function pathNames(obj, path) {
        const regx = /\/{2,9}/g, names = path.replace(regx, "/").split("/");
        if (path.slice(0, 1) == '/' || path.length === 0) {
            names.splice(0, 1);
        }
        if (path.slice(-1) == '/') {
            names.splice(names.length - 1, 1);
        }
        return names;
    }
    function queryKey(uri, query) {
        const data = {};
        query.replace(/(?:^|&)([^&=]*)=?([^&]*)/g, function ($0, $1, $2) {
            if ($1) {
                data[$1] = $2;
            }
        });
        return data;
    }

    const withEventListeners = typeof addEventListener === "function" &&
        typeof removeEventListener === "function";
    const OFFLINE_EVENT_LISTENERS = [];
    if (withEventListeners) {
        // within a ServiceWorker, any event handler for the 'offline' event must be added on the initial evaluation of the
        // script, so we create one single event listener here which will forward the event to the socket instances
        addEventListener("offline", () => {
            OFFLINE_EVENT_LISTENERS.forEach((listener) => listener());
        }, false);
    }
    /**
     * This class provides a WebSocket-like interface to connect to an Engine.IO server. The connection will be established
     * with one of the available low-level transports, like HTTP long-polling, WebSocket or WebTransport.
     *
     * This class comes without upgrade mechanism, which means that it will keep the first low-level transport that
     * successfully establishes the connection.
     *
     * In order to allow tree-shaking, there are no transports included, that's why the `transports` option is mandatory.
     *
     * @example
     * import { SocketWithoutUpgrade, WebSocket } from "engine.io-client";
     *
     * const socket = new SocketWithoutUpgrade({
     *   transports: [WebSocket]
     * });
     *
     * socket.on("open", () => {
     *   socket.send("hello");
     * });
     *
     * @see SocketWithUpgrade
     * @see Socket
     */
    class SocketWithoutUpgrade extends Emitter {
        /**
         * Socket constructor.
         *
         * @param {String|Object} uri - uri or options
         * @param {Object} opts - options
         */
        constructor(uri, opts) {
            super();
            this.binaryType = defaultBinaryType;
            this.writeBuffer = [];
            this._prevBufferLen = 0;
            this._pingInterval = -1;
            this._pingTimeout = -1;
            this._maxPayload = -1;
            /**
             * The expiration timestamp of the {@link _pingTimeoutTimer} object is tracked, in case the timer is throttled and the
             * callback is not fired on time. This can happen for example when a laptop is suspended or when a phone is locked.
             */
            this._pingTimeoutTime = Infinity;
            if (uri && "object" === typeof uri) {
                opts = uri;
                uri = null;
            }
            if (uri) {
                const parsedUri = parse(uri);
                opts.hostname = parsedUri.host;
                opts.secure =
                    parsedUri.protocol === "https" || parsedUri.protocol === "wss";
                opts.port = parsedUri.port;
                if (parsedUri.query)
                    opts.query = parsedUri.query;
            }
            else if (opts.host) {
                opts.hostname = parse(opts.host).host;
            }
            installTimerFunctions(this, opts);
            this.secure =
                null != opts.secure
                    ? opts.secure
                    : typeof location !== "undefined" && "https:" === location.protocol;
            if (opts.hostname && !opts.port) {
                // if no port is specified manually, use the protocol default
                opts.port = this.secure ? "443" : "80";
            }
            this.hostname =
                opts.hostname ||
                    (typeof location !== "undefined" ? location.hostname : "localhost");
            this.port =
                opts.port ||
                    (typeof location !== "undefined" && location.port
                        ? location.port
                        : this.secure
                            ? "443"
                            : "80");
            this.transports = [];
            this._transportsByName = {};
            opts.transports.forEach((t) => {
                const transportName = t.prototype.name;
                this.transports.push(transportName);
                this._transportsByName[transportName] = t;
            });
            this.opts = Object.assign({
                path: "/engine.io",
                agent: false,
                withCredentials: false,
                upgrade: true,
                timestampParam: "t",
                rememberUpgrade: false,
                addTrailingSlash: true,
                rejectUnauthorized: true,
                perMessageDeflate: {
                    threshold: 1024,
                },
                transportOptions: {},
                closeOnBeforeunload: false,
            }, opts);
            this.opts.path =
                this.opts.path.replace(/\/$/, "") +
                    (this.opts.addTrailingSlash ? "/" : "");
            if (typeof this.opts.query === "string") {
                this.opts.query = decode(this.opts.query);
            }
            if (withEventListeners) {
                if (this.opts.closeOnBeforeunload) {
                    // Firefox closes the connection when the "beforeunload" event is emitted but not Chrome. This event listener
                    // ensures every browser behaves the same (no "disconnect" event at the Socket.IO level when the page is
                    // closed/reloaded)
                    this._beforeunloadEventListener = () => {
                        if (this.transport) {
                            // silently close the transport
                            this.transport.removeAllListeners();
                            this.transport.close();
                        }
                    };
                    addEventListener("beforeunload", this._beforeunloadEventListener, false);
                }
                if (this.hostname !== "localhost") {
                    this._offlineEventListener = () => {
                        this._onClose("transport close", {
                            description: "network connection lost",
                        });
                    };
                    OFFLINE_EVENT_LISTENERS.push(this._offlineEventListener);
                }
            }
            if (this.opts.withCredentials) {
                this._cookieJar = createCookieJar();
            }
            this._open();
        }
        /**
         * Creates transport of the given type.
         *
         * @param {String} name - transport name
         * @return {Transport}
         * @private
         */
        createTransport(name) {
            const query = Object.assign({}, this.opts.query);
            // append engine.io protocol identifier
            query.EIO = protocol;
            // transport name
            query.transport = name;
            // session id if we already have one
            if (this.id)
                query.sid = this.id;
            const opts = Object.assign({}, this.opts, {
                query,
                socket: this,
                hostname: this.hostname,
                secure: this.secure,
                port: this.port,
            }, this.opts.transportOptions[name]);
            return new this._transportsByName[name](opts);
        }
        /**
         * Initializes transport to use and starts probe.
         *
         * @private
         */
        _open() {
            if (this.transports.length === 0) {
                // Emit error on next tick so it can be listened to
                this.setTimeoutFn(() => {
                    this.emitReserved("error", "No transports available");
                }, 0);
                return;
            }
            const transportName = this.opts.rememberUpgrade &&
                SocketWithoutUpgrade.priorWebsocketSuccess &&
                this.transports.indexOf("websocket") !== -1
                ? "websocket"
                : this.transports[0];
            this.readyState = "opening";
            const transport = this.createTransport(transportName);
            transport.open();
            this.setTransport(transport);
        }
        /**
         * Sets the current transport. Disables the existing one (if any).
         *
         * @private
         */
        setTransport(transport) {
            if (this.transport) {
                this.transport.removeAllListeners();
            }
            // set up transport
            this.transport = transport;
            // set up transport listeners
            transport
                .on("drain", this._onDrain.bind(this))
                .on("packet", this._onPacket.bind(this))
                .on("error", this._onError.bind(this))
                .on("close", (reason) => this._onClose("transport close", reason));
        }
        /**
         * Called when connection is deemed open.
         *
         * @private
         */
        onOpen() {
            this.readyState = "open";
            SocketWithoutUpgrade.priorWebsocketSuccess =
                "websocket" === this.transport.name;
            this.emitReserved("open");
            this.flush();
        }
        /**
         * Handles a packet.
         *
         * @private
         */
        _onPacket(packet) {
            if ("opening" === this.readyState ||
                "open" === this.readyState ||
                "closing" === this.readyState) {
                this.emitReserved("packet", packet);
                // Socket is live - any packet counts
                this.emitReserved("heartbeat");
                switch (packet.type) {
                    case "open":
                        this.onHandshake(JSON.parse(packet.data));
                        break;
                    case "ping":
                        this._sendPacket("pong");
                        this.emitReserved("ping");
                        this.emitReserved("pong");
                        this._resetPingTimeout();
                        break;
                    case "error":
                        const err = new Error("server error");
                        // @ts-ignore
                        err.code = packet.data;
                        this._onError(err);
                        break;
                    case "message":
                        this.emitReserved("data", packet.data);
                        this.emitReserved("message", packet.data);
                        break;
                }
            }
        }
        /**
         * Called upon handshake completion.
         *
         * @param {Object} data - handshake obj
         * @private
         */
        onHandshake(data) {
            this.emitReserved("handshake", data);
            this.id = data.sid;
            this.transport.query.sid = data.sid;
            this._pingInterval = data.pingInterval;
            this._pingTimeout = data.pingTimeout;
            this._maxPayload = data.maxPayload;
            this.onOpen();
            // In case open handler closes socket
            if ("closed" === this.readyState)
                return;
            this._resetPingTimeout();
        }
        /**
         * Sets and resets ping timeout timer based on server pings.
         *
         * @private
         */
        _resetPingTimeout() {
            this.clearTimeoutFn(this._pingTimeoutTimer);
            const delay = this._pingInterval + this._pingTimeout;
            this._pingTimeoutTime = Date.now() + delay;
            this._pingTimeoutTimer = this.setTimeoutFn(() => {
                this._onClose("ping timeout");
            }, delay);
            if (this.opts.autoUnref) {
                this._pingTimeoutTimer.unref();
            }
        }
        /**
         * Called on `drain` event
         *
         * @private
         */
        _onDrain() {
            this.writeBuffer.splice(0, this._prevBufferLen);
            // setting prevBufferLen = 0 is very important
            // for example, when upgrading, upgrade packet is sent over,
            // and a nonzero prevBufferLen could cause problems on `drain`
            this._prevBufferLen = 0;
            if (0 === this.writeBuffer.length) {
                this.emitReserved("drain");
            }
            else {
                this.flush();
            }
        }
        /**
         * Flush write buffers.
         *
         * @private
         */
        flush() {
            if ("closed" !== this.readyState &&
                this.transport.writable &&
                !this.upgrading &&
                this.writeBuffer.length) {
                const packets = this._getWritablePackets();
                this.transport.send(packets);
                // keep track of current length of writeBuffer
                // splice writeBuffer and callbackBuffer on `drain`
                this._prevBufferLen = packets.length;
                this.emitReserved("flush");
            }
        }
        /**
         * Ensure the encoded size of the writeBuffer is below the maxPayload value sent by the server (only for HTTP
         * long-polling)
         *
         * @private
         */
        _getWritablePackets() {
            const shouldCheckPayloadSize = this._maxPayload &&
                this.transport.name === "polling" &&
                this.writeBuffer.length > 1;
            if (!shouldCheckPayloadSize) {
                return this.writeBuffer;
            }
            let payloadSize = 1; // first packet type
            for (let i = 0; i < this.writeBuffer.length; i++) {
                const data = this.writeBuffer[i].data;
                if (data) {
                    payloadSize += byteLength(data);
                }
                if (i > 0 && payloadSize > this._maxPayload) {
                    return this.writeBuffer.slice(0, i);
                }
                payloadSize += 2; // separator + packet type
            }
            return this.writeBuffer;
        }
        /**
         * Checks whether the heartbeat timer has expired but the socket has not yet been notified.
         *
         * Note: this method is private for now because it does not really fit the WebSocket API, but if we put it in the
         * `write()` method then the message would not be buffered by the Socket.IO client.
         *
         * @return {boolean}
         * @private
         */
        /* private */ _hasPingExpired() {
            if (!this._pingTimeoutTime)
                return true;
            const hasExpired = Date.now() > this._pingTimeoutTime;
            if (hasExpired) {
                this._pingTimeoutTime = 0;
                nextTick(() => {
                    this._onClose("ping timeout");
                }, this.setTimeoutFn);
            }
            return hasExpired;
        }
        /**
         * Sends a message.
         *
         * @param {String} msg - message.
         * @param {Object} options.
         * @param {Function} fn - callback function.
         * @return {Socket} for chaining.
         */
        write(msg, options, fn) {
            this._sendPacket("message", msg, options, fn);
            return this;
        }
        /**
         * Sends a message. Alias of {@link Socket#write}.
         *
         * @param {String} msg - message.
         * @param {Object} options.
         * @param {Function} fn - callback function.
         * @return {Socket} for chaining.
         */
        send(msg, options, fn) {
            this._sendPacket("message", msg, options, fn);
            return this;
        }
        /**
         * Sends a packet.
         *
         * @param {String} type: packet type.
         * @param {String} data.
         * @param {Object} options.
         * @param {Function} fn - callback function.
         * @private
         */
        _sendPacket(type, data, options, fn) {
            if ("function" === typeof data) {
                fn = data;
                data = undefined;
            }
            if ("function" === typeof options) {
                fn = options;
                options = null;
            }
            if ("closing" === this.readyState || "closed" === this.readyState) {
                return;
            }
            options = options || {};
            options.compress = false !== options.compress;
            const packet = {
                type: type,
                data: data,
                options: options,
            };
            this.emitReserved("packetCreate", packet);
            this.writeBuffer.push(packet);
            if (fn)
                this.once("flush", fn);
            this.flush();
        }
        /**
         * Closes the connection.
         */
        close() {
            const close = () => {
                this._onClose("forced close");
                this.transport.close();
            };
            const cleanupAndClose = () => {
                this.off("upgrade", cleanupAndClose);
                this.off("upgradeError", cleanupAndClose);
                close();
            };
            const waitForUpgrade = () => {
                // wait for upgrade to finish since we can't send packets while pausing a transport
                this.once("upgrade", cleanupAndClose);
                this.once("upgradeError", cleanupAndClose);
            };
            if ("opening" === this.readyState || "open" === this.readyState) {
                this.readyState = "closing";
                if (this.writeBuffer.length) {
                    this.once("drain", () => {
                        if (this.upgrading) {
                            waitForUpgrade();
                        }
                        else {
                            close();
                        }
                    });
                }
                else if (this.upgrading) {
                    waitForUpgrade();
                }
                else {
                    close();
                }
            }
            return this;
        }
        /**
         * Called upon transport error
         *
         * @private
         */
        _onError(err) {
            SocketWithoutUpgrade.priorWebsocketSuccess = false;
            if (this.opts.tryAllTransports &&
                this.transports.length > 1 &&
                this.readyState === "opening") {
                this.transports.shift();
                return this._open();
            }
            this.emitReserved("error", err);
            this._onClose("transport error", err);
        }
        /**
         * Called upon transport close.
         *
         * @private
         */
        _onClose(reason, description) {
            if ("opening" === this.readyState ||
                "open" === this.readyState ||
                "closing" === this.readyState) {
                // clear timers
                this.clearTimeoutFn(this._pingTimeoutTimer);
                // stop event from firing again for transport
                this.transport.removeAllListeners("close");
                // ensure transport won't stay open
                this.transport.close();
                // ignore further transport communication
                this.transport.removeAllListeners();
                if (withEventListeners) {
                    if (this._beforeunloadEventListener) {
                        removeEventListener("beforeunload", this._beforeunloadEventListener, false);
                    }
                    if (this._offlineEventListener) {
                        const i = OFFLINE_EVENT_LISTENERS.indexOf(this._offlineEventListener);
                        if (i !== -1) {
                            OFFLINE_EVENT_LISTENERS.splice(i, 1);
                        }
                    }
                }
                // set ready state
                this.readyState = "closed";
                // clear session id
                this.id = null;
                // emit close event
                this.emitReserved("close", reason, description);
                // clean buffers after, so users can still
                // grab the buffers on `close` event
                this.writeBuffer = [];
                this._prevBufferLen = 0;
            }
        }
    }
    SocketWithoutUpgrade.protocol = protocol;
    /**
     * This class provides a WebSocket-like interface to connect to an Engine.IO server. The connection will be established
     * with one of the available low-level transports, like HTTP long-polling, WebSocket or WebTransport.
     *
     * This class comes with an upgrade mechanism, which means that once the connection is established with the first
     * low-level transport, it will try to upgrade to a better transport.
     *
     * In order to allow tree-shaking, there are no transports included, that's why the `transports` option is mandatory.
     *
     * @example
     * import { SocketWithUpgrade, WebSocket } from "engine.io-client";
     *
     * const socket = new SocketWithUpgrade({
     *   transports: [WebSocket]
     * });
     *
     * socket.on("open", () => {
     *   socket.send("hello");
     * });
     *
     * @see SocketWithoutUpgrade
     * @see Socket
     */
    class SocketWithUpgrade extends SocketWithoutUpgrade {
        constructor() {
            super(...arguments);
            this._upgrades = [];
        }
        onOpen() {
            super.onOpen();
            if ("open" === this.readyState && this.opts.upgrade) {
                for (let i = 0; i < this._upgrades.length; i++) {
                    this._probe(this._upgrades[i]);
                }
            }
        }
        /**
         * Probes a transport.
         *
         * @param {String} name - transport name
         * @private
         */
        _probe(name) {
            let transport = this.createTransport(name);
            let failed = false;
            SocketWithoutUpgrade.priorWebsocketSuccess = false;
            const onTransportOpen = () => {
                if (failed)
                    return;
                transport.send([{ type: "ping", data: "probe" }]);
                transport.once("packet", (msg) => {
                    if (failed)
                        return;
                    if ("pong" === msg.type && "probe" === msg.data) {
                        this.upgrading = true;
                        this.emitReserved("upgrading", transport);
                        if (!transport)
                            return;
                        SocketWithoutUpgrade.priorWebsocketSuccess =
                            "websocket" === transport.name;
                        this.transport.pause(() => {
                            if (failed)
                                return;
                            if ("closed" === this.readyState)
                                return;
                            cleanup();
                            this.setTransport(transport);
                            transport.send([{ type: "upgrade" }]);
                            this.emitReserved("upgrade", transport);
                            transport = null;
                            this.upgrading = false;
                            this.flush();
                        });
                    }
                    else {
                        const err = new Error("probe error");
                        // @ts-ignore
                        err.transport = transport.name;
                        this.emitReserved("upgradeError", err);
                    }
                });
            };
            function freezeTransport() {
                if (failed)
                    return;
                // Any callback called by transport should be ignored since now
                failed = true;
                cleanup();
                transport.close();
                transport = null;
            }
            // Handle any error that happens while probing
            const onerror = (err) => {
                const error = new Error("probe error: " + err);
                // @ts-ignore
                error.transport = transport.name;
                freezeTransport();
                this.emitReserved("upgradeError", error);
            };
            function onTransportClose() {
                onerror("transport closed");
            }
            // When the socket is closed while we're probing
            function onclose() {
                onerror("socket closed");
            }
            // When the socket is upgraded while we're probing
            function onupgrade(to) {
                if (transport && to.name !== transport.name) {
                    freezeTransport();
                }
            }
            // Remove all listeners on the transport and on self
            const cleanup = () => {
                transport.removeListener("open", onTransportOpen);
                transport.removeListener("error", onerror);
                transport.removeListener("close", onTransportClose);
                this.off("close", onclose);
                this.off("upgrading", onupgrade);
            };
            transport.once("open", onTransportOpen);
            transport.once("error", onerror);
            transport.once("close", onTransportClose);
            this.once("close", onclose);
            this.once("upgrading", onupgrade);
            if (this._upgrades.indexOf("webtransport") !== -1 &&
                name !== "webtransport") {
                // favor WebTransport
                this.setTimeoutFn(() => {
                    if (!failed) {
                        transport.open();
                    }
                }, 200);
            }
            else {
                transport.open();
            }
        }
        onHandshake(data) {
            this._upgrades = this._filterUpgrades(data.upgrades);
            super.onHandshake(data);
        }
        /**
         * Filters upgrades, returning only those matching client transports.
         *
         * @param {Array} upgrades - server upgrades
         * @private
         */
        _filterUpgrades(upgrades) {
            const filteredUpgrades = [];
            for (let i = 0; i < upgrades.length; i++) {
                if (~this.transports.indexOf(upgrades[i]))
                    filteredUpgrades.push(upgrades[i]);
            }
            return filteredUpgrades;
        }
    }
    /**
     * This class provides a WebSocket-like interface to connect to an Engine.IO server. The connection will be established
     * with one of the available low-level transports, like HTTP long-polling, WebSocket or WebTransport.
     *
     * This class comes with an upgrade mechanism, which means that once the connection is established with the first
     * low-level transport, it will try to upgrade to a better transport.
     *
     * @example
     * import { Socket } from "engine.io-client";
     *
     * const socket = new Socket();
     *
     * socket.on("open", () => {
     *   socket.send("hello");
     * });
     *
     * @see SocketWithoutUpgrade
     * @see SocketWithUpgrade
     */
    let Socket$1 = class Socket extends SocketWithUpgrade {
        constructor(uri, opts = {}) {
            const o = typeof uri === "object" ? uri : opts;
            if (!o.transports ||
                (o.transports && typeof o.transports[0] === "string")) {
                o.transports = (o.transports || ["polling", "websocket", "webtransport"])
                    .map((transportName) => transports[transportName])
                    .filter((t) => !!t);
            }
            super(uri, o);
        }
    };

    /**
     * URL parser.
     *
     * @param uri - url
     * @param path - the request path of the connection
     * @param loc - An object meant to mimic window.location.
     *        Defaults to window.location.
     * @public
     */
    function url(uri, path = "", loc) {
        let obj = uri;
        // default to window.location
        loc = loc || (typeof location !== "undefined" && location);
        if (null == uri)
            uri = loc.protocol + "//" + loc.host;
        // relative path support
        if (typeof uri === "string") {
            if ("/" === uri.charAt(0)) {
                if ("/" === uri.charAt(1)) {
                    uri = loc.protocol + uri;
                }
                else {
                    uri = loc.host + uri;
                }
            }
            if (!/^(https?|wss?):\/\//.test(uri)) {
                if ("undefined" !== typeof loc) {
                    uri = loc.protocol + "//" + uri;
                }
                else {
                    uri = "https://" + uri;
                }
            }
            // parse
            obj = parse(uri);
        }
        // make sure we treat `localhost:80` and `localhost` equally
        if (!obj.port) {
            if (/^(http|ws)$/.test(obj.protocol)) {
                obj.port = "80";
            }
            else if (/^(http|ws)s$/.test(obj.protocol)) {
                obj.port = "443";
            }
        }
        obj.path = obj.path || "/";
        const ipv6 = obj.host.indexOf(":") !== -1;
        const host = ipv6 ? "[" + obj.host + "]" : obj.host;
        // define unique id
        obj.id = obj.protocol + "://" + host + ":" + obj.port + path;
        // define href
        obj.href =
            obj.protocol +
                "://" +
                host +
                (loc && loc.port === obj.port ? "" : ":" + obj.port);
        return obj;
    }

    const withNativeArrayBuffer = typeof ArrayBuffer === "function";
    const isView = (obj) => {
        return typeof ArrayBuffer.isView === "function"
            ? ArrayBuffer.isView(obj)
            : obj.buffer instanceof ArrayBuffer;
    };
    const toString = Object.prototype.toString;
    const withNativeBlob = typeof Blob === "function" ||
        (typeof Blob !== "undefined" &&
            toString.call(Blob) === "[object BlobConstructor]");
    const withNativeFile = typeof File === "function" ||
        (typeof File !== "undefined" &&
            toString.call(File) === "[object FileConstructor]");
    /**
     * Returns true if obj is a Buffer, an ArrayBuffer, a Blob or a File.
     *
     * @private
     */
    function isBinary(obj) {
        return ((withNativeArrayBuffer && (obj instanceof ArrayBuffer || isView(obj))) ||
            (withNativeBlob && obj instanceof Blob) ||
            (withNativeFile && obj instanceof File));
    }
    function hasBinary(obj, toJSON) {
        if (!obj || typeof obj !== "object") {
            return false;
        }
        if (Array.isArray(obj)) {
            for (let i = 0, l = obj.length; i < l; i++) {
                if (hasBinary(obj[i])) {
                    return true;
                }
            }
            return false;
        }
        if (isBinary(obj)) {
            return true;
        }
        if (obj.toJSON &&
            typeof obj.toJSON === "function" &&
            arguments.length === 1) {
            return hasBinary(obj.toJSON(), true);
        }
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key) && hasBinary(obj[key])) {
                return true;
            }
        }
        return false;
    }

    /**
     * Replaces every Buffer | ArrayBuffer | Blob | File in packet with a numbered placeholder.
     *
     * @param {Object} packet - socket.io event packet
     * @return {Object} with deconstructed packet and list of buffers
     * @public
     */
    function deconstructPacket(packet) {
        const buffers = [];
        const packetData = packet.data;
        const pack = packet;
        pack.data = _deconstructPacket(packetData, buffers);
        pack.attachments = buffers.length; // number of binary 'attachments'
        return { packet: pack, buffers: buffers };
    }
    function _deconstructPacket(data, buffers) {
        if (!data)
            return data;
        if (isBinary(data)) {
            const placeholder = { _placeholder: true, num: buffers.length };
            buffers.push(data);
            return placeholder;
        }
        else if (Array.isArray(data)) {
            const newData = new Array(data.length);
            for (let i = 0; i < data.length; i++) {
                newData[i] = _deconstructPacket(data[i], buffers);
            }
            return newData;
        }
        else if (typeof data === "object" && !(data instanceof Date)) {
            const newData = {};
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    newData[key] = _deconstructPacket(data[key], buffers);
                }
            }
            return newData;
        }
        return data;
    }
    /**
     * Reconstructs a binary packet from its placeholder packet and buffers
     *
     * @param {Object} packet - event packet with placeholders
     * @param {Array} buffers - binary buffers to put in placeholder positions
     * @return {Object} reconstructed packet
     * @public
     */
    function reconstructPacket(packet, buffers) {
        packet.data = _reconstructPacket(packet.data, buffers);
        delete packet.attachments; // no longer useful
        return packet;
    }
    function _reconstructPacket(data, buffers) {
        if (!data)
            return data;
        if (data && data._placeholder === true) {
            const isIndexValid = typeof data.num === "number" &&
                data.num >= 0 &&
                data.num < buffers.length;
            if (isIndexValid) {
                return buffers[data.num]; // appropriate buffer (should be natural order anyway)
            }
            else {
                throw new Error("illegal attachments");
            }
        }
        else if (Array.isArray(data)) {
            for (let i = 0; i < data.length; i++) {
                data[i] = _reconstructPacket(data[i], buffers);
            }
        }
        else if (typeof data === "object") {
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    data[key] = _reconstructPacket(data[key], buffers);
                }
            }
        }
        return data;
    }

    /**
     * These strings must not be used as event names, as they have a special meaning.
     */
    const RESERVED_EVENTS$1 = [
        "connect", // used on the client side
        "connect_error", // used on the client side
        "disconnect", // used on both sides
        "disconnecting", // used on the server side
        "newListener", // used by the Node.js EventEmitter
        "removeListener", // used by the Node.js EventEmitter
    ];
    var PacketType;
    (function (PacketType) {
        PacketType[PacketType["CONNECT"] = 0] = "CONNECT";
        PacketType[PacketType["DISCONNECT"] = 1] = "DISCONNECT";
        PacketType[PacketType["EVENT"] = 2] = "EVENT";
        PacketType[PacketType["ACK"] = 3] = "ACK";
        PacketType[PacketType["CONNECT_ERROR"] = 4] = "CONNECT_ERROR";
        PacketType[PacketType["BINARY_EVENT"] = 5] = "BINARY_EVENT";
        PacketType[PacketType["BINARY_ACK"] = 6] = "BINARY_ACK";
    })(PacketType || (PacketType = {}));
    /**
     * A socket.io Encoder instance
     */
    class Encoder {
        /**
         * Encoder constructor
         *
         * @param {function} replacer - custom replacer to pass down to JSON.parse
         */
        constructor(replacer) {
            this.replacer = replacer;
        }
        /**
         * Encode a packet as a single string if non-binary, or as a
         * buffer sequence, depending on packet type.
         *
         * @param {Object} obj - packet object
         */
        encode(obj) {
            if (obj.type === PacketType.EVENT || obj.type === PacketType.ACK) {
                if (hasBinary(obj)) {
                    return this.encodeAsBinary({
                        type: obj.type === PacketType.EVENT
                            ? PacketType.BINARY_EVENT
                            : PacketType.BINARY_ACK,
                        nsp: obj.nsp,
                        data: obj.data,
                        id: obj.id,
                    });
                }
            }
            return [this.encodeAsString(obj)];
        }
        /**
         * Encode packet as string.
         */
        encodeAsString(obj) {
            // first is type
            let str = "" + obj.type;
            // attachments if we have them
            if (obj.type === PacketType.BINARY_EVENT ||
                obj.type === PacketType.BINARY_ACK) {
                str += obj.attachments + "-";
            }
            // if we have a namespace other than `/`
            // we append it followed by a comma `,`
            if (obj.nsp && "/" !== obj.nsp) {
                str += obj.nsp + ",";
            }
            // immediately followed by the id
            if (null != obj.id) {
                str += obj.id;
            }
            // json data
            if (null != obj.data) {
                str += JSON.stringify(obj.data, this.replacer);
            }
            return str;
        }
        /**
         * Encode packet as 'buffer sequence' by removing blobs, and
         * deconstructing packet into object with placeholders and
         * a list of buffers.
         */
        encodeAsBinary(obj) {
            const deconstruction = deconstructPacket(obj);
            const pack = this.encodeAsString(deconstruction.packet);
            const buffers = deconstruction.buffers;
            buffers.unshift(pack); // add packet info to beginning of data list
            return buffers; // write all the buffers
        }
    }
    /**
     * A socket.io Decoder instance
     *
     * @return {Object} decoder
     */
    class Decoder extends Emitter {
        /**
         * Decoder constructor
         */
        constructor(opts) {
            super();
            this.opts = Object.assign({
                reviver: undefined,
                maxAttachments: 10,
            }, typeof opts === "function" ? { reviver: opts } : opts);
        }
        /**
         * Decodes an encoded packet string into packet JSON.
         *
         * @param {String} obj - encoded packet
         */
        add(obj) {
            let packet;
            if (typeof obj === "string") {
                if (this.reconstructor) {
                    throw new Error("got plaintext data when reconstructing a packet");
                }
                packet = this.decodeString(obj);
                const isBinaryEvent = packet.type === PacketType.BINARY_EVENT;
                if (isBinaryEvent || packet.type === PacketType.BINARY_ACK) {
                    packet.type = isBinaryEvent ? PacketType.EVENT : PacketType.ACK;
                    // binary packet's json
                    this.reconstructor = new BinaryReconstructor(packet);
                    // no attachments, labeled binary but no binary data to follow
                    if (packet.attachments === 0) {
                        super.emitReserved("decoded", packet);
                    }
                }
                else {
                    // non-binary full packet
                    super.emitReserved("decoded", packet);
                }
            }
            else if (isBinary(obj) || obj.base64) {
                // raw binary data
                if (!this.reconstructor) {
                    throw new Error("got binary data when not reconstructing a packet");
                }
                else {
                    packet = this.reconstructor.takeBinaryData(obj);
                    if (packet) {
                        // received final buffer
                        this.reconstructor = null;
                        super.emitReserved("decoded", packet);
                    }
                }
            }
            else {
                throw new Error("Unknown type: " + obj);
            }
        }
        /**
         * Decode a packet String (JSON data)
         *
         * @param {String} str
         * @return {Object} packet
         */
        decodeString(str) {
            let i = 0;
            // look up type
            const p = {
                type: Number(str.charAt(0)),
            };
            if (PacketType[p.type] === undefined) {
                throw new Error("unknown packet type " + p.type);
            }
            // look up attachments if type binary
            if (p.type === PacketType.BINARY_EVENT ||
                p.type === PacketType.BINARY_ACK) {
                const start = i + 1;
                while (str.charAt(++i) !== "-" && i != str.length) { }
                const buf = str.substring(start, i);
                if (buf != Number(buf) || str.charAt(i) !== "-") {
                    throw new Error("Illegal attachments");
                }
                const n = Number(buf);
                if (!isInteger(n) || n < 0) {
                    throw new Error("Illegal attachments");
                }
                else if (n > this.opts.maxAttachments) {
                    throw new Error("too many attachments");
                }
                p.attachments = n;
            }
            // look up namespace (if any)
            if ("/" === str.charAt(i + 1)) {
                const start = i + 1;
                while (++i) {
                    const c = str.charAt(i);
                    if ("," === c)
                        break;
                    if (i === str.length)
                        break;
                }
                p.nsp = str.substring(start, i);
            }
            else {
                p.nsp = "/";
            }
            // look up id
            const next = str.charAt(i + 1);
            if ("" !== next && Number(next) == next) {
                const start = i + 1;
                while (++i) {
                    const c = str.charAt(i);
                    if (null == c || Number(c) != c) {
                        --i;
                        break;
                    }
                    if (i === str.length)
                        break;
                }
                p.id = Number(str.substring(start, i + 1));
            }
            // look up json data
            if (str.charAt(++i)) {
                const payload = this.tryParse(str.substr(i));
                if (Decoder.isPayloadValid(p.type, payload)) {
                    p.data = payload;
                }
                else {
                    throw new Error("invalid payload");
                }
            }
            return p;
        }
        tryParse(str) {
            try {
                return JSON.parse(str, this.opts.reviver);
            }
            catch (e) {
                return false;
            }
        }
        static isPayloadValid(type, payload) {
            switch (type) {
                case PacketType.CONNECT:
                    return isObject(payload);
                case PacketType.DISCONNECT:
                    return payload === undefined;
                case PacketType.CONNECT_ERROR:
                    return typeof payload === "string" || isObject(payload);
                case PacketType.EVENT:
                case PacketType.BINARY_EVENT:
                    return (Array.isArray(payload) &&
                        (typeof payload[0] === "number" ||
                            (typeof payload[0] === "string" &&
                                RESERVED_EVENTS$1.indexOf(payload[0]) === -1)));
                case PacketType.ACK:
                case PacketType.BINARY_ACK:
                    return Array.isArray(payload);
            }
        }
        /**
         * Deallocates a parser's resources
         */
        destroy() {
            if (this.reconstructor) {
                this.reconstructor.finishedReconstruction();
                this.reconstructor = null;
            }
        }
    }
    /**
     * A manager of a binary event's 'buffer sequence'. Should
     * be constructed whenever a packet of type BINARY_EVENT is
     * decoded.
     *
     * @param {Object} packet
     * @return {BinaryReconstructor} initialized reconstructor
     */
    class BinaryReconstructor {
        constructor(packet) {
            this.packet = packet;
            this.buffers = [];
            this.reconPack = packet;
        }
        /**
         * Method to be called when binary data received from connection
         * after a BINARY_EVENT packet.
         *
         * @param {Buffer | ArrayBuffer} binData - the raw binary data received
         * @return {null | Object} returns null if more binary data is expected or
         *   a reconstructed packet object if all buffers have been received.
         */
        takeBinaryData(binData) {
            this.buffers.push(binData);
            if (this.buffers.length === this.reconPack.attachments) {
                // done with buffer list
                const packet = reconstructPacket(this.reconPack, this.buffers);
                this.finishedReconstruction();
                return packet;
            }
            return null;
        }
        /**
         * Cleans up binary packet reconstruction variables.
         */
        finishedReconstruction() {
            this.reconPack = null;
            this.buffers = [];
        }
    }
    // see https://caniuse.com/mdn-javascript_builtins_number_isinteger
    const isInteger = Number.isInteger ||
        function (value) {
            return (typeof value === "number" &&
                isFinite(value) &&
                Math.floor(value) === value);
        };
    // see https://stackoverflow.com/questions/8511281/check-if-a-value-is-an-object-in-javascript
    function isObject(value) {
        return Object.prototype.toString.call(value) === "[object Object]";
    }

    var parser = /*#__PURE__*/Object.freeze({
        __proto__: null,
        Decoder: Decoder,
        Encoder: Encoder,
        get PacketType () { return PacketType; }
    });

    function on(obj, ev, fn) {
        obj.on(ev, fn);
        return function subDestroy() {
            obj.off(ev, fn);
        };
    }

    /**
     * Internal events.
     * These events can't be emitted by the user.
     */
    const RESERVED_EVENTS = Object.freeze({
        connect: 1,
        connect_error: 1,
        disconnect: 1,
        disconnecting: 1,
        // EventEmitter reserved events: https://nodejs.org/api/events.html#events_event_newlistener
        newListener: 1,
        removeListener: 1,
    });
    /**
     * A Socket is the fundamental class for interacting with the server.
     *
     * A Socket belongs to a certain Namespace (by default /) and uses an underlying {@link Manager} to communicate.
     *
     * @example
     * const socket = io();
     *
     * socket.on("connect", () => {
     *   console.log("connected");
     * });
     *
     * // send an event to the server
     * socket.emit("foo", "bar");
     *
     * socket.on("foobar", () => {
     *   // an event was received from the server
     * });
     *
     * // upon disconnection
     * socket.on("disconnect", (reason) => {
     *   console.log(`disconnected due to ${reason}`);
     * });
     */
    class Socket extends Emitter {
        /**
         * `Socket` constructor.
         */
        constructor(io, nsp, opts) {
            super();
            /**
             * Whether the socket is currently connected to the server.
             *
             * @example
             * const socket = io();
             *
             * socket.on("connect", () => {
             *   console.log(socket.connected); // true
             * });
             *
             * socket.on("disconnect", () => {
             *   console.log(socket.connected); // false
             * });
             */
            this.connected = false;
            /**
             * Whether the connection state was recovered after a temporary disconnection. In that case, any missed packets will
             * be transmitted by the server.
             */
            this.recovered = false;
            /**
             * Buffer for packets received before the CONNECT packet
             */
            this.receiveBuffer = [];
            /**
             * Buffer for packets that will be sent once the socket is connected
             */
            this.sendBuffer = [];
            /**
             * The queue of packets to be sent with retry in case of failure.
             *
             * Packets are sent one by one, each waiting for the server acknowledgement, in order to guarantee the delivery order.
             * @private
             */
            this._queue = [];
            /**
             * A sequence to generate the ID of the {@link QueuedPacket}.
             * @private
             */
            this._queueSeq = 0;
            this.ids = 0;
            /**
             * A map containing acknowledgement handlers.
             *
             * The `withError` attribute is used to differentiate handlers that accept an error as first argument:
             *
             * - `socket.emit("test", (err, value) => { ... })` with `ackTimeout` option
             * - `socket.timeout(5000).emit("test", (err, value) => { ... })`
             * - `const value = await socket.emitWithAck("test")`
             *
             * From those that don't:
             *
             * - `socket.emit("test", (value) => { ... });`
             *
             * In the first case, the handlers will be called with an error when:
             *
             * - the timeout is reached
             * - the socket gets disconnected
             *
             * In the second case, the handlers will be simply discarded upon disconnection, since the client will never receive
             * an acknowledgement from the server.
             *
             * @private
             */
            this.acks = {};
            this.flags = {};
            this.io = io;
            this.nsp = nsp;
            if (opts && opts.auth) {
                this.auth = opts.auth;
            }
            this._opts = Object.assign({}, opts);
            if (this.io._autoConnect)
                this.open();
        }
        /**
         * Whether the socket is currently disconnected
         *
         * @example
         * const socket = io();
         *
         * socket.on("connect", () => {
         *   console.log(socket.disconnected); // false
         * });
         *
         * socket.on("disconnect", () => {
         *   console.log(socket.disconnected); // true
         * });
         */
        get disconnected() {
            return !this.connected;
        }
        /**
         * Subscribe to open, close and packet events
         *
         * @private
         */
        subEvents() {
            if (this.subs)
                return;
            const io = this.io;
            this.subs = [
                on(io, "open", this.onopen.bind(this)),
                on(io, "packet", this.onpacket.bind(this)),
                on(io, "error", this.onerror.bind(this)),
                on(io, "close", this.onclose.bind(this)),
            ];
        }
        /**
         * Whether the Socket will try to reconnect when its Manager connects or reconnects.
         *
         * @example
         * const socket = io();
         *
         * console.log(socket.active); // true
         *
         * socket.on("disconnect", (reason) => {
         *   if (reason === "io server disconnect") {
         *     // the disconnection was initiated by the server, you need to manually reconnect
         *     console.log(socket.active); // false
         *   }
         *   // else the socket will automatically try to reconnect
         *   console.log(socket.active); // true
         * });
         */
        get active() {
            return !!this.subs;
        }
        /**
         * "Opens" the socket.
         *
         * @example
         * const socket = io({
         *   autoConnect: false
         * });
         *
         * socket.connect();
         */
        connect() {
            if (this.connected)
                return this;
            this.subEvents();
            if (!this.io["_reconnecting"])
                this.io.open(); // ensure open
            if ("open" === this.io._readyState)
                this.onopen();
            return this;
        }
        /**
         * Alias for {@link connect()}.
         */
        open() {
            return this.connect();
        }
        /**
         * Sends a `message` event.
         *
         * This method mimics the WebSocket.send() method.
         *
         * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send
         *
         * @example
         * socket.send("hello");
         *
         * // this is equivalent to
         * socket.emit("message", "hello");
         *
         * @return self
         */
        send(...args) {
            args.unshift("message");
            this.emit.apply(this, args);
            return this;
        }
        /**
         * Override `emit`.
         * If the event is in `events`, it's emitted normally.
         *
         * @example
         * socket.emit("hello", "world");
         *
         * // all serializable datastructures are supported (no need to call JSON.stringify)
         * socket.emit("hello", 1, "2", { 3: ["4"], 5: Uint8Array.from([6]) });
         *
         * // with an acknowledgement from the server
         * socket.emit("hello", "world", (val) => {
         *   // ...
         * });
         *
         * @return self
         */
        emit(ev, ...args) {
            var _a, _b, _c;
            if (RESERVED_EVENTS.hasOwnProperty(ev)) {
                throw new Error('"' + ev.toString() + '" is a reserved event name');
            }
            args.unshift(ev);
            if (this._opts.retries && !this.flags.fromQueue && !this.flags.volatile) {
                this._addToQueue(args);
                return this;
            }
            const packet = {
                type: PacketType.EVENT,
                data: args,
            };
            packet.options = {};
            packet.options.compress = this.flags.compress !== false;
            // event ack callback
            if ("function" === typeof args[args.length - 1]) {
                const id = this.ids++;
                const ack = args.pop();
                this._registerAckCallback(id, ack);
                packet.id = id;
            }
            const isTransportWritable = (_b = (_a = this.io.engine) === null || _a === void 0 ? void 0 : _a.transport) === null || _b === void 0 ? void 0 : _b.writable;
            const isConnected = this.connected && !((_c = this.io.engine) === null || _c === void 0 ? void 0 : _c._hasPingExpired());
            const discardPacket = this.flags.volatile && !isTransportWritable;
            if (discardPacket) ;
            else if (isConnected) {
                this.notifyOutgoingListeners(packet);
                this.packet(packet);
            }
            else {
                this.sendBuffer.push(packet);
            }
            this.flags = {};
            return this;
        }
        /**
         * @private
         */
        _registerAckCallback(id, ack) {
            var _a;
            const timeout = (_a = this.flags.timeout) !== null && _a !== void 0 ? _a : this._opts.ackTimeout;
            if (timeout === undefined) {
                this.acks[id] = ack;
                return;
            }
            // @ts-ignore
            const timer = this.io.setTimeoutFn(() => {
                delete this.acks[id];
                for (let i = 0; i < this.sendBuffer.length; i++) {
                    if (this.sendBuffer[i].id === id) {
                        this.sendBuffer.splice(i, 1);
                    }
                }
                ack.call(this, new Error("operation has timed out"));
            }, timeout);
            const fn = (...args) => {
                // @ts-ignore
                this.io.clearTimeoutFn(timer);
                ack.apply(this, args);
            };
            fn.withError = true;
            this.acks[id] = fn;
        }
        /**
         * Emits an event and waits for an acknowledgement
         *
         * @example
         * // without timeout
         * const response = await socket.emitWithAck("hello", "world");
         *
         * // with a specific timeout
         * try {
         *   const response = await socket.timeout(1000).emitWithAck("hello", "world");
         * } catch (err) {
         *   // the server did not acknowledge the event in the given delay
         * }
         *
         * @return a Promise that will be fulfilled when the server acknowledges the event
         */
        emitWithAck(ev, ...args) {
            return new Promise((resolve, reject) => {
                const fn = (arg1, arg2) => {
                    return arg1 ? reject(arg1) : resolve(arg2);
                };
                fn.withError = true;
                args.push(fn);
                this.emit(ev, ...args);
            });
        }
        /**
         * Add the packet to the queue.
         * @param args
         * @private
         */
        _addToQueue(args) {
            let ack;
            if (typeof args[args.length - 1] === "function") {
                ack = args.pop();
            }
            const packet = {
                id: this._queueSeq++,
                tryCount: 0,
                pending: false,
                args,
                flags: Object.assign({ fromQueue: true }, this.flags),
            };
            args.push((err, ...responseArgs) => {
                if (packet !== this._queue[0]) ;
                const hasError = err !== null;
                if (hasError) {
                    if (packet.tryCount > this._opts.retries) {
                        this._queue.shift();
                        if (ack) {
                            ack(err);
                        }
                    }
                }
                else {
                    this._queue.shift();
                    if (ack) {
                        ack(null, ...responseArgs);
                    }
                }
                packet.pending = false;
                return this._drainQueue();
            });
            this._queue.push(packet);
            this._drainQueue();
        }
        /**
         * Send the first packet of the queue, and wait for an acknowledgement from the server.
         * @param force - whether to resend a packet that has not been acknowledged yet
         *
         * @private
         */
        _drainQueue(force = false) {
            if (!this.connected || this._queue.length === 0) {
                return;
            }
            const packet = this._queue[0];
            if (packet.pending && !force) {
                return;
            }
            packet.pending = true;
            packet.tryCount++;
            this.flags = packet.flags;
            this.emit.apply(this, packet.args);
        }
        /**
         * Sends a packet.
         *
         * @param packet
         * @private
         */
        packet(packet) {
            packet.nsp = this.nsp;
            this.io._packet(packet);
        }
        /**
         * Called upon engine `open`.
         *
         * @private
         */
        onopen() {
            if (typeof this.auth == "function") {
                this.auth((data) => {
                    this._sendConnectPacket(data);
                });
            }
            else {
                this._sendConnectPacket(this.auth);
            }
        }
        /**
         * Sends a CONNECT packet to initiate the Socket.IO session.
         *
         * @param data
         * @private
         */
        _sendConnectPacket(data) {
            this.packet({
                type: PacketType.CONNECT,
                data: this._pid
                    ? Object.assign({ pid: this._pid, offset: this._lastOffset }, data)
                    : data,
            });
        }
        /**
         * Called upon engine or manager `error`.
         *
         * @param err
         * @private
         */
        onerror(err) {
            if (!this.connected) {
                this.emitReserved("connect_error", err);
            }
        }
        /**
         * Called upon engine `close`.
         *
         * @param reason
         * @param description
         * @private
         */
        onclose(reason, description) {
            this.connected = false;
            delete this.id;
            this.emitReserved("disconnect", reason, description);
            this._clearAcks();
        }
        /**
         * Clears the acknowledgement handlers upon disconnection, since the client will never receive an acknowledgement from
         * the server.
         *
         * @private
         */
        _clearAcks() {
            Object.keys(this.acks).forEach((id) => {
                const isBuffered = this.sendBuffer.some((packet) => String(packet.id) === id);
                if (!isBuffered) {
                    // note: handlers that do not accept an error as first argument are ignored here
                    const ack = this.acks[id];
                    delete this.acks[id];
                    if (ack.withError) {
                        ack.call(this, new Error("socket has been disconnected"));
                    }
                }
            });
        }
        /**
         * Called with socket packet.
         *
         * @param packet
         * @private
         */
        onpacket(packet) {
            const sameNamespace = packet.nsp === this.nsp;
            if (!sameNamespace)
                return;
            switch (packet.type) {
                case PacketType.CONNECT:
                    if (packet.data && packet.data.sid) {
                        this.onconnect(packet.data.sid, packet.data.pid);
                    }
                    else {
                        this.emitReserved("connect_error", new Error("It seems you are trying to reach a Socket.IO server in v2.x with a v3.x client, but they are not compatible (more information here: https://socket.io/docs/v3/migrating-from-2-x-to-3-0/)"));
                    }
                    break;
                case PacketType.EVENT:
                case PacketType.BINARY_EVENT:
                    this.onevent(packet);
                    break;
                case PacketType.ACK:
                case PacketType.BINARY_ACK:
                    this.onack(packet);
                    break;
                case PacketType.DISCONNECT:
                    this.ondisconnect();
                    break;
                case PacketType.CONNECT_ERROR:
                    this.destroy();
                    const err = new Error(packet.data.message);
                    // @ts-ignore
                    err.data = packet.data.data;
                    this.emitReserved("connect_error", err);
                    break;
            }
        }
        /**
         * Called upon a server event.
         *
         * @param packet
         * @private
         */
        onevent(packet) {
            const args = packet.data || [];
            if (null != packet.id) {
                args.push(this.ack(packet.id));
            }
            if (this.connected) {
                this.emitEvent(args);
            }
            else {
                this.receiveBuffer.push(Object.freeze(args));
            }
        }
        emitEvent(args) {
            if (this._anyListeners && this._anyListeners.length) {
                const listeners = this._anyListeners.slice();
                for (const listener of listeners) {
                    listener.apply(this, args);
                }
            }
            super.emit.apply(this, args);
            if (this._pid && args.length && typeof args[args.length - 1] === "string") {
                this._lastOffset = args[args.length - 1];
            }
        }
        /**
         * Produces an ack callback to emit with an event.
         *
         * @private
         */
        ack(id) {
            const self = this;
            let sent = false;
            return function (...args) {
                // prevent double callbacks
                if (sent)
                    return;
                sent = true;
                self.packet({
                    type: PacketType.ACK,
                    id: id,
                    data: args,
                });
            };
        }
        /**
         * Called upon a server acknowledgement.
         *
         * @param packet
         * @private
         */
        onack(packet) {
            const ack = this.acks[packet.id];
            if (typeof ack !== "function") {
                return;
            }
            delete this.acks[packet.id];
            // @ts-ignore FIXME ack is incorrectly inferred as 'never'
            if (ack.withError) {
                packet.data.unshift(null);
            }
            // @ts-ignore
            ack.apply(this, packet.data);
        }
        /**
         * Called upon server connect.
         *
         * @private
         */
        onconnect(id, pid) {
            this.id = id;
            this.recovered = pid && this._pid === pid;
            this._pid = pid; // defined only if connection state recovery is enabled
            this.connected = true;
            this.emitBuffered();
            this._drainQueue(true);
            this.emitReserved("connect");
        }
        /**
         * Emit buffered events (received and emitted).
         *
         * @private
         */
        emitBuffered() {
            this.receiveBuffer.forEach((args) => this.emitEvent(args));
            this.receiveBuffer = [];
            this.sendBuffer.forEach((packet) => {
                this.notifyOutgoingListeners(packet);
                this.packet(packet);
            });
            this.sendBuffer = [];
        }
        /**
         * Called upon server disconnect.
         *
         * @private
         */
        ondisconnect() {
            this.destroy();
            this.onclose("io server disconnect");
        }
        /**
         * Called upon forced client/server side disconnections,
         * this method ensures the manager stops tracking us and
         * that reconnections don't get triggered for this.
         *
         * @private
         */
        destroy() {
            if (this.subs) {
                // clean subscriptions to avoid reconnections
                this.subs.forEach((subDestroy) => subDestroy());
                this.subs = undefined;
            }
            this.io["_destroy"](this);
        }
        /**
         * Disconnects the socket manually. In that case, the socket will not try to reconnect.
         *
         * If this is the last active Socket instance of the {@link Manager}, the low-level connection will be closed.
         *
         * @example
         * const socket = io();
         *
         * socket.on("disconnect", (reason) => {
         *   // console.log(reason); prints "io client disconnect"
         * });
         *
         * socket.disconnect();
         *
         * @return self
         */
        disconnect() {
            if (this.connected) {
                this.packet({ type: PacketType.DISCONNECT });
            }
            // remove socket from pool
            this.destroy();
            if (this.connected) {
                // fire events
                this.onclose("io client disconnect");
            }
            return this;
        }
        /**
         * Alias for {@link disconnect()}.
         *
         * @return self
         */
        close() {
            return this.disconnect();
        }
        /**
         * Sets the compress flag.
         *
         * @example
         * socket.compress(false).emit("hello");
         *
         * @param compress - if `true`, compresses the sending data
         * @return self
         */
        compress(compress) {
            this.flags.compress = compress;
            return this;
        }
        /**
         * Sets a modifier for a subsequent event emission that the event message will be dropped when this socket is not
         * ready to send messages.
         *
         * @example
         * socket.volatile.emit("hello"); // the server may or may not receive it
         *
         * @returns self
         */
        get volatile() {
            this.flags.volatile = true;
            return this;
        }
        /**
         * Sets a modifier for a subsequent event emission that the callback will be called with an error when the
         * given number of milliseconds have elapsed without an acknowledgement from the server:
         *
         * @example
         * socket.timeout(5000).emit("my-event", (err) => {
         *   if (err) {
         *     // the server did not acknowledge the event in the given delay
         *   }
         * });
         *
         * @returns self
         */
        timeout(timeout) {
            this.flags.timeout = timeout;
            return this;
        }
        /**
         * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
         * callback.
         *
         * @example
         * socket.onAny((event, ...args) => {
         *   console.log(`got ${event}`);
         * });
         *
         * @param listener
         */
        onAny(listener) {
            this._anyListeners = this._anyListeners || [];
            this._anyListeners.push(listener);
            return this;
        }
        /**
         * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
         * callback. The listener is added to the beginning of the listeners array.
         *
         * @example
         * socket.prependAny((event, ...args) => {
         *   console.log(`got event ${event}`);
         * });
         *
         * @param listener
         */
        prependAny(listener) {
            this._anyListeners = this._anyListeners || [];
            this._anyListeners.unshift(listener);
            return this;
        }
        /**
         * Removes the listener that will be fired when any event is emitted.
         *
         * @example
         * const catchAllListener = (event, ...args) => {
         *   console.log(`got event ${event}`);
         * }
         *
         * socket.onAny(catchAllListener);
         *
         * // remove a specific listener
         * socket.offAny(catchAllListener);
         *
         * // or remove all listeners
         * socket.offAny();
         *
         * @param listener
         */
        offAny(listener) {
            if (!this._anyListeners) {
                return this;
            }
            if (listener) {
                const listeners = this._anyListeners;
                for (let i = 0; i < listeners.length; i++) {
                    if (listener === listeners[i]) {
                        listeners.splice(i, 1);
                        return this;
                    }
                }
            }
            else {
                this._anyListeners = [];
            }
            return this;
        }
        /**
         * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
         * e.g. to remove listeners.
         */
        listenersAny() {
            return this._anyListeners || [];
        }
        /**
         * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
         * callback.
         *
         * Note: acknowledgements sent to the server are not included.
         *
         * @example
         * socket.onAnyOutgoing((event, ...args) => {
         *   console.log(`sent event ${event}`);
         * });
         *
         * @param listener
         */
        onAnyOutgoing(listener) {
            this._anyOutgoingListeners = this._anyOutgoingListeners || [];
            this._anyOutgoingListeners.push(listener);
            return this;
        }
        /**
         * Adds a listener that will be fired when any event is emitted. The event name is passed as the first argument to the
         * callback. The listener is added to the beginning of the listeners array.
         *
         * Note: acknowledgements sent to the server are not included.
         *
         * @example
         * socket.prependAnyOutgoing((event, ...args) => {
         *   console.log(`sent event ${event}`);
         * });
         *
         * @param listener
         */
        prependAnyOutgoing(listener) {
            this._anyOutgoingListeners = this._anyOutgoingListeners || [];
            this._anyOutgoingListeners.unshift(listener);
            return this;
        }
        /**
         * Removes the listener that will be fired when any event is emitted.
         *
         * @example
         * const catchAllListener = (event, ...args) => {
         *   console.log(`sent event ${event}`);
         * }
         *
         * socket.onAnyOutgoing(catchAllListener);
         *
         * // remove a specific listener
         * socket.offAnyOutgoing(catchAllListener);
         *
         * // or remove all listeners
         * socket.offAnyOutgoing();
         *
         * @param [listener] - the catch-all listener (optional)
         */
        offAnyOutgoing(listener) {
            if (!this._anyOutgoingListeners) {
                return this;
            }
            if (listener) {
                const listeners = this._anyOutgoingListeners;
                for (let i = 0; i < listeners.length; i++) {
                    if (listener === listeners[i]) {
                        listeners.splice(i, 1);
                        return this;
                    }
                }
            }
            else {
                this._anyOutgoingListeners = [];
            }
            return this;
        }
        /**
         * Returns an array of listeners that are listening for any event that is specified. This array can be manipulated,
         * e.g. to remove listeners.
         */
        listenersAnyOutgoing() {
            return this._anyOutgoingListeners || [];
        }
        /**
         * Notify the listeners for each packet sent
         *
         * @param packet
         *
         * @private
         */
        notifyOutgoingListeners(packet) {
            if (this._anyOutgoingListeners && this._anyOutgoingListeners.length) {
                const listeners = this._anyOutgoingListeners.slice();
                for (const listener of listeners) {
                    listener.apply(this, packet.data);
                }
            }
        }
    }

    /**
     * Initialize backoff timer with `opts`.
     *
     * - `min` initial timeout in milliseconds [100]
     * - `max` max timeout [10000]
     * - `jitter` [0]
     * - `factor` [2]
     *
     * @param {Object} opts
     * @api public
     */
    function Backoff(opts) {
        opts = opts || {};
        this.ms = opts.min || 100;
        this.max = opts.max || 10000;
        this.factor = opts.factor || 2;
        this.jitter = opts.jitter > 0 && opts.jitter <= 1 ? opts.jitter : 0;
        this.attempts = 0;
    }
    /**
     * Return the backoff duration.
     *
     * @return {Number}
     * @api public
     */
    Backoff.prototype.duration = function () {
        var ms = this.ms * Math.pow(this.factor, this.attempts++);
        if (this.jitter) {
            var rand = Math.random();
            var deviation = Math.floor(rand * this.jitter * ms);
            ms = (Math.floor(rand * 10) & 1) == 0 ? ms - deviation : ms + deviation;
        }
        return Math.min(ms, this.max) | 0;
    };
    /**
     * Reset the number of attempts.
     *
     * @api public
     */
    Backoff.prototype.reset = function () {
        this.attempts = 0;
    };
    /**
     * Set the minimum duration
     *
     * @api public
     */
    Backoff.prototype.setMin = function (min) {
        this.ms = min;
    };
    /**
     * Set the maximum duration
     *
     * @api public
     */
    Backoff.prototype.setMax = function (max) {
        this.max = max;
    };
    /**
     * Set the jitter
     *
     * @api public
     */
    Backoff.prototype.setJitter = function (jitter) {
        this.jitter = jitter;
    };

    class Manager extends Emitter {
        constructor(uri, opts) {
            var _a;
            super();
            this.nsps = {};
            this.subs = [];
            if (uri && "object" === typeof uri) {
                opts = uri;
                uri = undefined;
            }
            opts = opts || {};
            opts.path = opts.path || "/socket.io";
            this.opts = opts;
            installTimerFunctions(this, opts);
            this.reconnection(opts.reconnection !== false);
            this.reconnectionAttempts(opts.reconnectionAttempts || Infinity);
            this.reconnectionDelay(opts.reconnectionDelay || 1000);
            this.reconnectionDelayMax(opts.reconnectionDelayMax || 5000);
            this.randomizationFactor((_a = opts.randomizationFactor) !== null && _a !== void 0 ? _a : 0.5);
            this.backoff = new Backoff({
                min: this.reconnectionDelay(),
                max: this.reconnectionDelayMax(),
                jitter: this.randomizationFactor(),
            });
            this.timeout(null == opts.timeout ? 20000 : opts.timeout);
            this._readyState = "closed";
            this.uri = uri;
            const _parser = opts.parser || parser;
            this.encoder = new _parser.Encoder();
            this.decoder = new _parser.Decoder();
            this._autoConnect = opts.autoConnect !== false;
            if (this._autoConnect)
                this.open();
        }
        reconnection(v) {
            if (!arguments.length)
                return this._reconnection;
            this._reconnection = !!v;
            if (!v) {
                this.skipReconnect = true;
            }
            return this;
        }
        reconnectionAttempts(v) {
            if (v === undefined)
                return this._reconnectionAttempts;
            this._reconnectionAttempts = v;
            return this;
        }
        reconnectionDelay(v) {
            var _a;
            if (v === undefined)
                return this._reconnectionDelay;
            this._reconnectionDelay = v;
            (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMin(v);
            return this;
        }
        randomizationFactor(v) {
            var _a;
            if (v === undefined)
                return this._randomizationFactor;
            this._randomizationFactor = v;
            (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setJitter(v);
            return this;
        }
        reconnectionDelayMax(v) {
            var _a;
            if (v === undefined)
                return this._reconnectionDelayMax;
            this._reconnectionDelayMax = v;
            (_a = this.backoff) === null || _a === void 0 ? void 0 : _a.setMax(v);
            return this;
        }
        timeout(v) {
            if (!arguments.length)
                return this._timeout;
            this._timeout = v;
            return this;
        }
        /**
         * Starts trying to reconnect if reconnection is enabled and we have not
         * started reconnecting yet
         *
         * @private
         */
        maybeReconnectOnOpen() {
            // Only try to reconnect if it's the first time we're connecting
            if (!this._reconnecting &&
                this._reconnection &&
                this.backoff.attempts === 0) {
                // keeps reconnection from firing twice for the same reconnection loop
                this.reconnect();
            }
        }
        /**
         * Sets the current transport `socket`.
         *
         * @param {Function} fn - optional, callback
         * @return self
         * @public
         */
        open(fn) {
            if (~this._readyState.indexOf("open"))
                return this;
            this.engine = new Socket$1(this.uri, this.opts);
            const socket = this.engine;
            const self = this;
            this._readyState = "opening";
            this.skipReconnect = false;
            // emit `open`
            const openSubDestroy = on(socket, "open", function () {
                self.onopen();
                fn && fn();
            });
            const onError = (err) => {
                this.cleanup();
                this._readyState = "closed";
                this.emitReserved("error", err);
                if (fn) {
                    fn(err);
                }
                else {
                    // Only do this if there is no fn to handle the error
                    this.maybeReconnectOnOpen();
                }
            };
            // emit `error`
            const errorSub = on(socket, "error", onError);
            if (false !== this._timeout) {
                const timeout = this._timeout;
                // set timer
                const timer = this.setTimeoutFn(() => {
                    openSubDestroy();
                    onError(new Error("timeout"));
                    socket.close();
                }, timeout);
                if (this.opts.autoUnref) {
                    timer.unref();
                }
                this.subs.push(() => {
                    this.clearTimeoutFn(timer);
                });
            }
            this.subs.push(openSubDestroy);
            this.subs.push(errorSub);
            return this;
        }
        /**
         * Alias for open()
         *
         * @return self
         * @public
         */
        connect(fn) {
            return this.open(fn);
        }
        /**
         * Called upon transport open.
         *
         * @private
         */
        onopen() {
            // clear old subs
            this.cleanup();
            // mark as open
            this._readyState = "open";
            this.emitReserved("open");
            // add new subs
            const socket = this.engine;
            this.subs.push(on(socket, "ping", this.onping.bind(this)), on(socket, "data", this.ondata.bind(this)), on(socket, "error", this.onerror.bind(this)), on(socket, "close", this.onclose.bind(this)), 
            // @ts-ignore
            on(this.decoder, "decoded", this.ondecoded.bind(this)));
        }
        /**
         * Called upon a ping.
         *
         * @private
         */
        onping() {
            this.emitReserved("ping");
        }
        /**
         * Called with data.
         *
         * @private
         */
        ondata(data) {
            try {
                this.decoder.add(data);
            }
            catch (e) {
                this.onclose("parse error", e);
            }
        }
        /**
         * Called when parser fully decodes a packet.
         *
         * @private
         */
        ondecoded(packet) {
            // the nextTick call prevents an exception in a user-provided event listener from triggering a disconnection due to a "parse error"
            nextTick(() => {
                this.emitReserved("packet", packet);
            }, this.setTimeoutFn);
        }
        /**
         * Called upon socket error.
         *
         * @private
         */
        onerror(err) {
            this.emitReserved("error", err);
        }
        /**
         * Creates a new socket for the given `nsp`.
         *
         * @return {Socket}
         * @public
         */
        socket(nsp, opts) {
            let socket = this.nsps[nsp];
            if (!socket) {
                socket = new Socket(this, nsp, opts);
                this.nsps[nsp] = socket;
            }
            else if (this._autoConnect && !socket.active) {
                socket.connect();
            }
            return socket;
        }
        /**
         * Called upon a socket close.
         *
         * @param socket
         * @private
         */
        _destroy(socket) {
            const nsps = Object.keys(this.nsps);
            for (const nsp of nsps) {
                const socket = this.nsps[nsp];
                if (socket.active) {
                    return;
                }
            }
            this._close();
        }
        /**
         * Writes a packet.
         *
         * @param packet
         * @private
         */
        _packet(packet) {
            const encodedPackets = this.encoder.encode(packet);
            for (let i = 0; i < encodedPackets.length; i++) {
                this.engine.write(encodedPackets[i], packet.options);
            }
        }
        /**
         * Clean up transport subscriptions and packet buffer.
         *
         * @private
         */
        cleanup() {
            this.subs.forEach((subDestroy) => subDestroy());
            this.subs.length = 0;
            this.decoder.destroy();
        }
        /**
         * Close the current socket.
         *
         * @private
         */
        _close() {
            this.skipReconnect = true;
            this._reconnecting = false;
            this.onclose("forced close");
        }
        /**
         * Alias for close()
         *
         * @private
         */
        disconnect() {
            return this._close();
        }
        /**
         * Called when:
         *
         * - the low-level engine is closed
         * - the parser encountered a badly formatted packet
         * - all sockets are disconnected
         *
         * @private
         */
        onclose(reason, description) {
            var _a;
            this.cleanup();
            (_a = this.engine) === null || _a === void 0 ? void 0 : _a.close();
            this.backoff.reset();
            this._readyState = "closed";
            this.emitReserved("close", reason, description);
            if (this._reconnection && !this.skipReconnect) {
                this.reconnect();
            }
        }
        /**
         * Attempt a reconnection.
         *
         * @private
         */
        reconnect() {
            if (this._reconnecting || this.skipReconnect)
                return this;
            const self = this;
            if (this.backoff.attempts >= this._reconnectionAttempts) {
                this.backoff.reset();
                this.emitReserved("reconnect_failed");
                this._reconnecting = false;
            }
            else {
                const delay = this.backoff.duration();
                this._reconnecting = true;
                const timer = this.setTimeoutFn(() => {
                    if (self.skipReconnect)
                        return;
                    this.emitReserved("reconnect_attempt", self.backoff.attempts);
                    // check again for the case socket closed in above events
                    if (self.skipReconnect)
                        return;
                    self.open((err) => {
                        if (err) {
                            self._reconnecting = false;
                            self.reconnect();
                            this.emitReserved("reconnect_error", err);
                        }
                        else {
                            self.onreconnect();
                        }
                    });
                }, delay);
                if (this.opts.autoUnref) {
                    timer.unref();
                }
                this.subs.push(() => {
                    this.clearTimeoutFn(timer);
                });
            }
        }
        /**
         * Called upon successful reconnect.
         *
         * @private
         */
        onreconnect() {
            const attempt = this.backoff.attempts;
            this._reconnecting = false;
            this.backoff.reset();
            this.emitReserved("reconnect", attempt);
        }
    }

    /**
     * Managers cache.
     */
    const cache = {};
    function lookup(uri, opts) {
        if (typeof uri === "object") {
            opts = uri;
            uri = undefined;
        }
        opts = opts || {};
        const parsed = url(uri, opts.path || "/socket.io");
        const source = parsed.source;
        const id = parsed.id;
        const path = parsed.path;
        const sameNamespace = cache[id] && path in cache[id]["nsps"];
        const newConnection = opts.forceNew ||
            opts["force new connection"] ||
            false === opts.multiplex ||
            sameNamespace;
        let io;
        if (newConnection) {
            io = new Manager(source, opts);
        }
        else {
            if (!cache[id]) {
                cache[id] = new Manager(source, opts);
            }
            io = cache[id];
        }
        if (parsed.query && !opts.query) {
            opts.query = parsed.queryKey;
        }
        return io.socket(parsed.path, opts);
    }
    // so that "lookup" can be used both as a function (e.g. `io(...)`) and as a
    // namespace (e.g. `io.connect(...)`), for backward compatibility
    Object.assign(lookup, {
        Manager,
        Socket,
        io: lookup,
        connect: lookup,
    });

    var socket_ioMsgpackParser = {};

    var lib = {};

    var encode_1;
    var hasRequiredEncode;

    function requireEncode () {
    	if (hasRequiredEncode) return encode_1;
    	hasRequiredEncode = 1;

    	function utf8Write(view, offset, str) {
    	  var c = 0;
    	  for (var i = 0, l = str.length; i < l; i++) {
    	    c = str.charCodeAt(i);
    	    if (c < 0x80) {
    	      view.setUint8(offset++, c);
    	    }
    	    else if (c < 0x800) {
    	      view.setUint8(offset++, 0xc0 | (c >> 6));
    	      view.setUint8(offset++, 0x80 | (c & 0x3f));
    	    }
    	    else if (c < 0xd800 || c >= 0xe000) {
    	      view.setUint8(offset++, 0xe0 | (c >> 12));
    	      view.setUint8(offset++, 0x80 | (c >> 6) & 0x3f);
    	      view.setUint8(offset++, 0x80 | (c & 0x3f));
    	    }
    	    else {
    	      i++;
    	      c = 0x10000 + (((c & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
    	      view.setUint8(offset++, 0xf0 | (c >> 18));
    	      view.setUint8(offset++, 0x80 | (c >> 12) & 0x3f);
    	      view.setUint8(offset++, 0x80 | (c >> 6) & 0x3f);
    	      view.setUint8(offset++, 0x80 | (c & 0x3f));
    	    }
    	  }
    	}

    	function utf8Length(str) {
    	  var c = 0, length = 0;
    	  for (var i = 0, l = str.length; i < l; i++) {
    	    c = str.charCodeAt(i);
    	    if (c < 0x80) {
    	      length += 1;
    	    }
    	    else if (c < 0x800) {
    	      length += 2;
    	    }
    	    else if (c < 0xd800 || c >= 0xe000) {
    	      length += 3;
    	    }
    	    else {
    	      i++;
    	      length += 4;
    	    }
    	  }
    	  return length;
    	}

    	function _encode(bytes, defers, value) {
    	  var type = typeof value, i = 0, l = 0, hi = 0, lo = 0, length = 0, size = 0;

    	  if (type === 'string') {
    	    length = utf8Length(value);

    	    // fixstr
    	    if (length < 0x20) {
    	      bytes.push(length | 0xa0);
    	      size = 1;
    	    }
    	    // str 8
    	    else if (length < 0x100) {
    	      bytes.push(0xd9, length);
    	      size = 2;
    	    }
    	    // str 16
    	    else if (length < 0x10000) {
    	      bytes.push(0xda, length >> 8, length);
    	      size = 3;
    	    }
    	    // str 32
    	    else if (length < 0x100000000) {
    	      bytes.push(0xdb, length >> 24, length >> 16, length >> 8, length);
    	      size = 5;
    	    } else {
    	      throw new Error('String too long');
    	    }
    	    defers.push({ _str: value, _length: length, _offset: bytes.length });
    	    return size + length;
    	  }
    	  if (type === 'number') {
    	    // TODO: encode to float 32?

    	    // float 64
    	    if (Math.floor(value) !== value || !isFinite(value)) {
    	      bytes.push(0xcb);
    	      defers.push({ _float: value, _length: 8, _offset: bytes.length });
    	      return 9;
    	    }

    	    if (value >= 0) {
    	      // positive fixnum
    	      if (value < 0x80) {
    	        bytes.push(value);
    	        return 1;
    	      }
    	      // uint 8
    	      if (value < 0x100) {
    	        bytes.push(0xcc, value);
    	        return 2;
    	      }
    	      // uint 16
    	      if (value < 0x10000) {
    	        bytes.push(0xcd, value >> 8, value);
    	        return 3;
    	      }
    	      // uint 32
    	      if (value < 0x100000000) {
    	        bytes.push(0xce, value >> 24, value >> 16, value >> 8, value);
    	        return 5;
    	      }
    	      // uint 64
    	      hi = (value / Math.pow(2, 32)) >> 0;
    	      lo = value >>> 0;
    	      bytes.push(0xcf, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
    	      return 9;
    	    } else {
    	      // negative fixnum
    	      if (value >= -32) {
    	        bytes.push(value);
    	        return 1;
    	      }
    	      // int 8
    	      if (value >= -128) {
    	        bytes.push(0xd0, value);
    	        return 2;
    	      }
    	      // int 16
    	      if (value >= -32768) {
    	        bytes.push(0xd1, value >> 8, value);
    	        return 3;
    	      }
    	      // int 32
    	      if (value >= -2147483648) {
    	        bytes.push(0xd2, value >> 24, value >> 16, value >> 8, value);
    	        return 5;
    	      }
    	      // int 64
    	      hi = Math.floor(value / Math.pow(2, 32));
    	      lo = value >>> 0;
    	      bytes.push(0xd3, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
    	      return 9;
    	    }
    	  }
    	  if (type === 'object') {
    	    // nil
    	    if (value === null) {
    	      bytes.push(0xc0);
    	      return 1;
    	    }

    	    if (Array.isArray(value)) {
    	      length = value.length;

    	      // fixarray
    	      if (length < 0x10) {
    	        bytes.push(length | 0x90);
    	        size = 1;
    	      }
    	      // array 16
    	      else if (length < 0x10000) {
    	        bytes.push(0xdc, length >> 8, length);
    	        size = 3;
    	      }
    	      // array 32
    	      else if (length < 0x100000000) {
    	        bytes.push(0xdd, length >> 24, length >> 16, length >> 8, length);
    	        size = 5;
    	      } else {
    	        throw new Error('Array too large');
    	      }
    	      for (i = 0; i < length; i++) {
    	        size += _encode(bytes, defers, value[i]);
    	      }
    	      return size;
    	    }

    	    // fixext 8 / Date
    	    if (value instanceof Date) {
    	      var time = value.getTime();
    	      hi = Math.floor(time / Math.pow(2, 32));
    	      lo = time >>> 0;
    	      bytes.push(0xd7, 0, hi >> 24, hi >> 16, hi >> 8, hi, lo >> 24, lo >> 16, lo >> 8, lo);
    	      return 10;
    	    }

    	    if (value instanceof ArrayBuffer) {
    	      length = value.byteLength;

    	      // bin 8
    	      if (length < 0x100) {
    	        bytes.push(0xc4, length);
    	        size = 2;
    	      } else
    	      // bin 16
    	      if (length < 0x10000) {
    	        bytes.push(0xc5, length >> 8, length);
    	        size = 3;
    	      } else
    	      // bin 32
    	      if (length < 0x100000000) {
    	        bytes.push(0xc6, length >> 24, length >> 16, length >> 8, length);
    	        size = 5;
    	      } else {
    	        throw new Error('Buffer too large');
    	      }
    	      defers.push({ _bin: value, _length: length, _offset: bytes.length });
    	      return size + length;
    	    }

    	    if (typeof value.toJSON === 'function') {
    	      return _encode(bytes, defers, value.toJSON());
    	    }

    	    var keys = [], key = '';

    	    var allKeys = Object.keys(value);
    	    for (i = 0, l = allKeys.length; i < l; i++) {
    	      key = allKeys[i];
    	      if (typeof value[key] !== 'function') {
    	        keys.push(key);
    	      }
    	    }
    	    length = keys.length;

    	    // fixmap
    	    if (length < 0x10) {
    	      bytes.push(length | 0x80);
    	      size = 1;
    	    }
    	    // map 16
    	    else if (length < 0x10000) {
    	      bytes.push(0xde, length >> 8, length);
    	      size = 3;
    	    }
    	    // map 32
    	    else if (length < 0x100000000) {
    	      bytes.push(0xdf, length >> 24, length >> 16, length >> 8, length);
    	      size = 5;
    	    } else {
    	      throw new Error('Object too large');
    	    }

    	    for (i = 0; i < length; i++) {
    	      key = keys[i];
    	      size += _encode(bytes, defers, key);
    	      size += _encode(bytes, defers, value[key]);
    	    }
    	    return size;
    	  }
    	  // false/true
    	  if (type === 'boolean') {
    	    bytes.push(value ? 0xc3 : 0xc2);
    	    return 1;
    	  }
    	  // fixext 1 / undefined
    	  if (type === 'undefined') {
    	    bytes.push(0xd4, 0, 0);
    	    return 3;
    	  }
    	  throw new Error('Could not encode');
    	}

    	function encode(value) {
    	  var bytes = [];
    	  var defers = [];
    	  var size = _encode(bytes, defers, value);
    	  var buf = new ArrayBuffer(size);
    	  var view = new DataView(buf);

    	  var deferIndex = 0;
    	  var deferWritten = 0;
    	  var nextOffset = -1;
    	  if (defers.length > 0) {
    	    nextOffset = defers[0]._offset;
    	  }

    	  var defer, deferLength = 0, offset = 0;
    	  for (var i = 0, l = bytes.length; i < l; i++) {
    	    view.setUint8(deferWritten + i, bytes[i]);
    	    if (i + 1 !== nextOffset) { continue; }
    	    defer = defers[deferIndex];
    	    deferLength = defer._length;
    	    offset = deferWritten + nextOffset;
    	    if (defer._bin) {
    	      var bin = new Uint8Array(defer._bin);
    	      for (var j = 0; j < deferLength; j++) {
    	        view.setUint8(offset + j, bin[j]);
    	      }
    	    } else if (defer._str) {
    	      utf8Write(view, offset, defer._str);
    	    } else if (defer._float !== undefined) {
    	      view.setFloat64(offset, defer._float);
    	    }
    	    deferIndex++;
    	    deferWritten += deferLength;
    	    if (defers[deferIndex]) {
    	      nextOffset = defers[deferIndex]._offset;
    	    }
    	  }
    	  return buf;
    	}

    	encode_1 = encode;
    	return encode_1;
    }

    var decode_1;
    var hasRequiredDecode;

    function requireDecode () {
    	if (hasRequiredDecode) return decode_1;
    	hasRequiredDecode = 1;

    	function Decoder(buffer) {
    	  this._offset = 0;
    	  if (buffer instanceof ArrayBuffer || Object.prototype.toString.call(buffer) === "[object ArrayBuffer]") {
    	    this._buffer = buffer;
    	    this._view = new DataView(this._buffer);
    	  } else if (ArrayBuffer.isView(buffer)) {
    	    this._buffer = buffer.buffer;
    	    this._view = new DataView(this._buffer, buffer.byteOffset, buffer.byteLength);
    	  } else {
    	    throw new Error('Invalid argument');
    	  }
    	}

    	function utf8Read(view, offset, length) {
    	  var string = '', chr = 0;
    	  for (var i = offset, end = offset + length; i < end; i++) {
    	    var byte = view.getUint8(i);
    	    if ((byte & 0x80) === 0x00) {
    	      string += String.fromCharCode(byte);
    	      continue;
    	    }
    	    if ((byte & 0xe0) === 0xc0) {
    	      string += String.fromCharCode(
    	        ((byte & 0x1f) << 6) |
    	        (view.getUint8(++i) & 0x3f)
    	      );
    	      continue;
    	    }
    	    if ((byte & 0xf0) === 0xe0) {
    	      string += String.fromCharCode(
    	        ((byte & 0x0f) << 12) |
    	        ((view.getUint8(++i) & 0x3f) << 6) |
    	        ((view.getUint8(++i) & 0x3f) << 0)
    	      );
    	      continue;
    	    }
    	    if ((byte & 0xf8) === 0xf0) {
    	      chr = ((byte & 0x07) << 18) |
    	        ((view.getUint8(++i) & 0x3f) << 12) |
    	        ((view.getUint8(++i) & 0x3f) << 6) |
    	        ((view.getUint8(++i) & 0x3f) << 0);
    	      if (chr >= 0x010000) { // surrogate pair
    	        chr -= 0x010000;
    	        string += String.fromCharCode((chr >>> 10) + 0xD800, (chr & 0x3FF) + 0xDC00);
    	      } else {
    	        string += String.fromCharCode(chr);
    	      }
    	      continue;
    	    }
    	    throw new Error('Invalid byte ' + byte.toString(16));
    	  }
    	  return string;
    	}

    	Decoder.prototype._array = function (length) {
    	  var value = new Array(length);
    	  for (var i = 0; i < length; i++) {
    	    value[i] = this._parse();
    	  }
    	  return value;
    	};

    	Decoder.prototype._map = function (length) {
    	  var key = '', value = {};
    	  for (var i = 0; i < length; i++) {
    	    key = this._parse();
    	    value[key] = this._parse();
    	  }
    	  return value;
    	};

    	Decoder.prototype._str = function (length) {
    	  var value = utf8Read(this._view, this._offset, length);
    	  this._offset += length;
    	  return value;
    	};

    	Decoder.prototype._bin = function (length) {
    	  var value = this._buffer.slice(this._offset, this._offset + length);
    	  this._offset += length;
    	  return value;
    	};

    	Decoder.prototype._parse = function () {
    	  var prefix = this._view.getUint8(this._offset++);
    	  var value, length = 0, type = 0, hi = 0, lo = 0;

    	  if (prefix < 0xc0) {
    	    // positive fixint
    	    if (prefix < 0x80) {
    	      return prefix;
    	    }
    	    // fixmap
    	    if (prefix < 0x90) {
    	      return this._map(prefix & 0x0f);
    	    }
    	    // fixarray
    	    if (prefix < 0xa0) {
    	      return this._array(prefix & 0x0f);
    	    }
    	    // fixstr
    	    return this._str(prefix & 0x1f);
    	  }

    	  // negative fixint
    	  if (prefix > 0xdf) {
    	    return (0xff - prefix + 1) * -1;
    	  }

    	  switch (prefix) {
    	    // nil
    	    case 0xc0:
    	      return null;
    	    // false
    	    case 0xc2:
    	      return false;
    	    // true
    	    case 0xc3:
    	      return true;

    	    // bin
    	    case 0xc4:
    	      length = this._view.getUint8(this._offset);
    	      this._offset += 1;
    	      return this._bin(length);
    	    case 0xc5:
    	      length = this._view.getUint16(this._offset);
    	      this._offset += 2;
    	      return this._bin(length);
    	    case 0xc6:
    	      length = this._view.getUint32(this._offset);
    	      this._offset += 4;
    	      return this._bin(length);

    	    // ext
    	    case 0xc7:
    	      length = this._view.getUint8(this._offset);
    	      type = this._view.getInt8(this._offset + 1);
    	      this._offset += 2;
    	      return [type, this._bin(length)];
    	    case 0xc8:
    	      length = this._view.getUint16(this._offset);
    	      type = this._view.getInt8(this._offset + 2);
    	      this._offset += 3;
    	      return [type, this._bin(length)];
    	    case 0xc9:
    	      length = this._view.getUint32(this._offset);
    	      type = this._view.getInt8(this._offset + 4);
    	      this._offset += 5;
    	      return [type, this._bin(length)];

    	    // float
    	    case 0xca:
    	      value = this._view.getFloat32(this._offset);
    	      this._offset += 4;
    	      return value;
    	    case 0xcb:
    	      value = this._view.getFloat64(this._offset);
    	      this._offset += 8;
    	      return value;

    	    // uint
    	    case 0xcc:
    	      value = this._view.getUint8(this._offset);
    	      this._offset += 1;
    	      return value;
    	    case 0xcd:
    	      value = this._view.getUint16(this._offset);
    	      this._offset += 2;
    	      return value;
    	    case 0xce:
    	      value = this._view.getUint32(this._offset);
    	      this._offset += 4;
    	      return value;
    	    case 0xcf:
    	      hi = this._view.getUint32(this._offset) * Math.pow(2, 32);
    	      lo = this._view.getUint32(this._offset + 4);
    	      this._offset += 8;
    	      return hi + lo;

    	    // int
    	    case 0xd0:
    	      value = this._view.getInt8(this._offset);
    	      this._offset += 1;
    	      return value;
    	    case 0xd1:
    	      value = this._view.getInt16(this._offset);
    	      this._offset += 2;
    	      return value;
    	    case 0xd2:
    	      value = this._view.getInt32(this._offset);
    	      this._offset += 4;
    	      return value;
    	    case 0xd3:
    	      hi = this._view.getInt32(this._offset) * Math.pow(2, 32);
    	      lo = this._view.getUint32(this._offset + 4);
    	      this._offset += 8;
    	      return hi + lo;

    	    // fixext
    	    case 0xd4:
    	      type = this._view.getInt8(this._offset);
    	      this._offset += 1;
    	      if (type === 0x00) {
    	        this._offset += 1;
    	        return void 0;
    	      }
    	      return [type, this._bin(1)];
    	    case 0xd5:
    	      type = this._view.getInt8(this._offset);
    	      this._offset += 1;
    	      return [type, this._bin(2)];
    	    case 0xd6:
    	      type = this._view.getInt8(this._offset);
    	      this._offset += 1;
    	      return [type, this._bin(4)];
    	    case 0xd7:
    	      type = this._view.getInt8(this._offset);
    	      this._offset += 1;
    	      if (type === 0x00) {
    	        hi = this._view.getInt32(this._offset) * Math.pow(2, 32);
    	        lo = this._view.getUint32(this._offset + 4);
    	        this._offset += 8;
    	        return new Date(hi + lo);
    	      }
    	      return [type, this._bin(8)];
    	    case 0xd8:
    	      type = this._view.getInt8(this._offset);
    	      this._offset += 1;
    	      return [type, this._bin(16)];

    	    // str
    	    case 0xd9:
    	      length = this._view.getUint8(this._offset);
    	      this._offset += 1;
    	      return this._str(length);
    	    case 0xda:
    	      length = this._view.getUint16(this._offset);
    	      this._offset += 2;
    	      return this._str(length);
    	    case 0xdb:
    	      length = this._view.getUint32(this._offset);
    	      this._offset += 4;
    	      return this._str(length);

    	    // array
    	    case 0xdc:
    	      length = this._view.getUint16(this._offset);
    	      this._offset += 2;
    	      return this._array(length);
    	    case 0xdd:
    	      length = this._view.getUint32(this._offset);
    	      this._offset += 4;
    	      return this._array(length);

    	    // map
    	    case 0xde:
    	      length = this._view.getUint16(this._offset);
    	      this._offset += 2;
    	      return this._map(length);
    	    case 0xdf:
    	      length = this._view.getUint32(this._offset);
    	      this._offset += 4;
    	      return this._map(length);
    	  }

    	  throw new Error('Could not parse');
    	};

    	function decode(buffer) {
    	  var decoder = new Decoder(buffer);
    	  var value = decoder._parse();
    	  if (decoder._offset !== buffer.byteLength) {
    	    throw new Error((buffer.byteLength - decoder._offset) + ' trailing bytes');
    	  }
    	  return value;
    	}

    	decode_1 = decode;
    	return decode_1;
    }

    var hasRequiredLib;

    function requireLib () {
    	if (hasRequiredLib) return lib;
    	hasRequiredLib = 1;
    	lib.encode = requireEncode();
    	lib.decode = requireDecode();
    	return lib;
    }

    var componentEmitter = {exports: {}};

    var hasRequiredComponentEmitter;

    function requireComponentEmitter () {
    	if (hasRequiredComponentEmitter) return componentEmitter.exports;
    	hasRequiredComponentEmitter = 1;
    	(function (module) {
    		/**
    		 * Expose `Emitter`.
    		 */

    		{
    		  module.exports = Emitter;
    		}

    		/**
    		 * Initialize a new `Emitter`.
    		 *
    		 * @api public
    		 */

    		function Emitter(obj) {
    		  if (obj) return mixin(obj);
    		}
    		/**
    		 * Mixin the emitter properties.
    		 *
    		 * @param {Object} obj
    		 * @return {Object}
    		 * @api private
    		 */

    		function mixin(obj) {
    		  for (var key in Emitter.prototype) {
    		    obj[key] = Emitter.prototype[key];
    		  }
    		  return obj;
    		}

    		/**
    		 * Listen on the given `event` with `fn`.
    		 *
    		 * @param {String} event
    		 * @param {Function} fn
    		 * @return {Emitter}
    		 * @api public
    		 */

    		Emitter.prototype.on =
    		Emitter.prototype.addEventListener = function(event, fn){
    		  this._callbacks = this._callbacks || {};
    		  (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
    		    .push(fn);
    		  return this;
    		};

    		/**
    		 * Adds an `event` listener that will be invoked a single
    		 * time then automatically removed.
    		 *
    		 * @param {String} event
    		 * @param {Function} fn
    		 * @return {Emitter}
    		 * @api public
    		 */

    		Emitter.prototype.once = function(event, fn){
    		  function on() {
    		    this.off(event, on);
    		    fn.apply(this, arguments);
    		  }

    		  on.fn = fn;
    		  this.on(event, on);
    		  return this;
    		};

    		/**
    		 * Remove the given callback for `event` or all
    		 * registered callbacks.
    		 *
    		 * @param {String} event
    		 * @param {Function} fn
    		 * @return {Emitter}
    		 * @api public
    		 */

    		Emitter.prototype.off =
    		Emitter.prototype.removeListener =
    		Emitter.prototype.removeAllListeners =
    		Emitter.prototype.removeEventListener = function(event, fn){
    		  this._callbacks = this._callbacks || {};

    		  // all
    		  if (0 == arguments.length) {
    		    this._callbacks = {};
    		    return this;
    		  }

    		  // specific event
    		  var callbacks = this._callbacks['$' + event];
    		  if (!callbacks) return this;

    		  // remove all handlers
    		  if (1 == arguments.length) {
    		    delete this._callbacks['$' + event];
    		    return this;
    		  }

    		  // remove specific handler
    		  var cb;
    		  for (var i = 0; i < callbacks.length; i++) {
    		    cb = callbacks[i];
    		    if (cb === fn || cb.fn === fn) {
    		      callbacks.splice(i, 1);
    		      break;
    		    }
    		  }

    		  // Remove event specific arrays for event types that no
    		  // one is subscribed for to avoid memory leak.
    		  if (callbacks.length === 0) {
    		    delete this._callbacks['$' + event];
    		  }

    		  return this;
    		};

    		/**
    		 * Emit `event` with the given args.
    		 *
    		 * @param {String} event
    		 * @param {Mixed} ...
    		 * @return {Emitter}
    		 */

    		Emitter.prototype.emit = function(event){
    		  this._callbacks = this._callbacks || {};

    		  var args = new Array(arguments.length - 1)
    		    , callbacks = this._callbacks['$' + event];

    		  for (var i = 1; i < arguments.length; i++) {
    		    args[i - 1] = arguments[i];
    		  }

    		  if (callbacks) {
    		    callbacks = callbacks.slice(0);
    		    for (var i = 0, len = callbacks.length; i < len; ++i) {
    		      callbacks[i].apply(this, args);
    		    }
    		  }

    		  return this;
    		};

    		/**
    		 * Return array of callbacks for `event`.
    		 *
    		 * @param {String} event
    		 * @return {Array}
    		 * @api public
    		 */

    		Emitter.prototype.listeners = function(event){
    		  this._callbacks = this._callbacks || {};
    		  return this._callbacks['$' + event] || [];
    		};

    		/**
    		 * Check if this emitter has `event` handlers.
    		 *
    		 * @param {String} event
    		 * @return {Boolean}
    		 * @api public
    		 */

    		Emitter.prototype.hasListeners = function(event){
    		  return !! this.listeners(event).length;
    		}; 
    	} (componentEmitter));
    	return componentEmitter.exports;
    }

    var hasRequiredSocket_ioMsgpackParser;

    function requireSocket_ioMsgpackParser () {
    	if (hasRequiredSocket_ioMsgpackParser) return socket_ioMsgpackParser;
    	hasRequiredSocket_ioMsgpackParser = 1;
    	var msgpack = requireLib();
    	var Emitter = requireComponentEmitter();

    	socket_ioMsgpackParser.protocol = 5;

    	/**
    	 * Packet types (see https://github.com/socketio/socket.io-protocol)
    	 */

    	var PacketType = (socket_ioMsgpackParser.PacketType = {
    	  CONNECT: 0,
    	  DISCONNECT: 1,
    	  EVENT: 2,
    	  ACK: 3,
    	  CONNECT_ERROR: 4,
    	});

    	var isInteger =
    	  Number.isInteger ||
    	  function (value) {
    	    return (
    	      typeof value === "number" &&
    	      isFinite(value) &&
    	      Math.floor(value) === value
    	    );
    	  };

    	var isString = function (value) {
    	  return typeof value === "string";
    	};

    	var isObject = function (value) {
    	  return Object.prototype.toString.call(value) === "[object Object]";
    	};

    	function Encoder() {}

    	Encoder.prototype.encode = function (packet) {
    	  return [msgpack.encode(packet)];
    	};

    	function Decoder() {}

    	Emitter(Decoder.prototype);

    	Decoder.prototype.add = function (obj) {
    	  var decoded = msgpack.decode(obj);
    	  this.checkPacket(decoded);
    	  this.emit("decoded", decoded);
    	};

    	function isDataValid(decoded) {
    	  switch (decoded.type) {
    	    case PacketType.CONNECT:
    	      return decoded.data === undefined || isObject(decoded.data);
    	    case PacketType.DISCONNECT:
    	      return decoded.data === undefined;
    	    case PacketType.CONNECT_ERROR:
    	      return isString(decoded.data) || isObject(decoded.data);
    	    default:
    	      return Array.isArray(decoded.data);
    	  }
    	}

    	Decoder.prototype.checkPacket = function (decoded) {
    	  var isTypeValid =
    	    isInteger(decoded.type) &&
    	    decoded.type >= PacketType.CONNECT &&
    	    decoded.type <= PacketType.CONNECT_ERROR;
    	  if (!isTypeValid) {
    	    throw new Error("invalid packet type");
    	  }

    	  if (!isString(decoded.nsp)) {
    	    throw new Error("invalid namespace");
    	  }

    	  if (!isDataValid(decoded)) {
    	    throw new Error("invalid payload");
    	  }

    	  var isAckValid = decoded.id === undefined || isInteger(decoded.id);
    	  if (!isAckValid) {
    	    throw new Error("invalid packet id");
    	  }
    	};

    	Decoder.prototype.destroy = function () {};

    	socket_ioMsgpackParser.Encoder = Encoder;
    	socket_ioMsgpackParser.Decoder = Decoder;
    	return socket_ioMsgpackParser;
    }

    var socket_ioMsgpackParserExports = requireSocket_ioMsgpackParser();
    var index = /*@__PURE__*/getDefaultExportFromCjs(socket_ioMsgpackParserExports);

    var msgpackParser = /*#__PURE__*/_mergeNamespaces({
        __proto__: null,
        default: index
    }, [socket_ioMsgpackParserExports]);

    const SETTINGS_KEY = 'settings';

    const DEFAULTS = {
        autoCloseSeasonPassPopup: true,
        enableKeyboardShortcuts: true,
        showRecipesWhenCrafting: true,
        showRecipeWhenConsuming: true,
        revealHiddenZones: true,
        enhancedTheatreMode: true,
        enableInventorySearch: true,
        enablePingIndicator: true,
        monitorSeasonPass: true,
        monitorSeasonPassXL: true,
        videoStutterImprover: true,
        smartAntiSpam: false,
        adminLogSize: 200,
        staffLogSize: 200,
        modLogSize: 200,
        fishLogSize: 200,
        pingsLogSize: 200,
        ttsLogSize: 200,
        sfxLogSize: 200,
    };

    let settings = { ...DEFAULTS };

    function loadSettings() {
        const saved = get(SETTINGS_KEY, null);
        if (saved) {
            settings = { ...DEFAULTS, ...saved };
        }
        return settings;
    }

    function getSetting(key) {
        return settings[key];
    }

    function updateSetting(key, value) {
        settings[key] = value;
        set(SETTINGS_KEY, settings);
    }

    /**
     * ui-helpers.js — Reusable UI builder functions
     *
     * Contains all the small DOM-building helpers used by the settings
     * modal and log panels. No state, no side effects — pure functions
     * that return HTML strings or DOM elements.
     *
     * Log row styling matches the site's chat message layout:
     * - Avatar on the left
     * - Username and message inline on the same line
     * - Timestamp on its own line at bottom right
     */


    // ── Timestamp formatting ────────────────────────────────────────────

    function formatTimestamp(ts) {
        const d = new Date(ts);
        const date = `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(2)}`;
        const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        return `${date}, ${time}`;
    }

    // ── HTML string builders (for innerHTML injection) ──────────────────

    function toggleRow(label, key, value, subLabel = null) {
        return `
        <div class="flex items-center justify-between py-2 border-b-1 border-dark-400/50">
            <div>
                <span class="text-sm font-medium">${label}</span>
                ${subLabel ? `<div class="text-xs opacity-50 mt-0.5">${subLabel}</div>` : ''}
            </div>
            <div class="flex gap-2 items-center">
                <div class="text-xs uppercase font-bold text-shadow-panel opacity-60">On</div>
                <button data-ftl-toggle="${key}" class="cursor-pointer box-content relative bg-dark-300 rounded-lg w-[32px] h-[16px] shadow-md inset-shadow-[0px_4px_4px_#00000050] border-1 border-light/50 hover:brightness-110 focus-visible:outline-1 focus-visible:outline-tertiary" type="button">
                    <div class="absolute top-[0px] ${value ? 'left-[0px]' : 'left-[calc(100%-16px)]'} bg-gradient-to-t from-dark-500 to-dark-600 h-[14px] w-[14px] rounded-[100%] border-1 border-dark-400/75 box-content transition-all ease-spring duration-100"></div>
                </button>
                <div class="text-xs uppercase font-bold text-shadow-panel opacity-60">Off</div>
            </div>
        </div>
    `;
    }

    function logPill(key, label) {
        return `
        <button data-ftl-log="${key}" class="bg-gradient-to-b from-dark-400/75 to-dark-500/75 h-[28px] p-0.5 inline-flex items-center justify-center text-center rounded-md cursor-pointer hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary flex-1 brightness-50" type="button">
            <div class="text-light-text bg-gradient-to-t from-dark-300 to-dark-400 text-shadow-md border-light/25 text-xs px-1 flex justify-center items-center h-full w-full m-auto rounded-md border-2 text-center font-medium whitespace-nowrap leading-none">${label}</div>
        </button>
    `;
    }

    // ── DOM element builders (for log rows) ─────────────────────────────

    /**
     * Type @username into the Slate chat input, closing any open modal first.
     */
    function mentionUser(username) {
        document.dispatchEvent(new CustomEvent('modalClose'));
        setTimeout(() => {
            const editor = document.querySelector('[data-slate-editor="true"]');
            if (!editor || !username) return;

            editor.focus();
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(editor);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);

            const text = '@' + username + ' ';
            setTimeout(() => {
                for (const ch of text) {
                    const charCode = ch.charCodeAt(0);
                    const isLetter = /[a-zA-Z]/.test(ch);
                    const code = isLetter ? 'Key' + ch.toUpperCase() : '';
                    const init = { key: ch, code, charCode, keyCode: charCode, which: charCode, bubbles: true, cancelable: true };
                    editor.dispatchEvent(new KeyboardEvent('keydown', init));
                    editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, data: ch, inputType: 'insertText' }));
                    editor.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: ch, inputType: 'insertText' }));
                    editor.dispatchEvent(new KeyboardEvent('keyup', init));
                }
            }, 0);
        }, 50);
    }

    // ── URL reconstruction ──────────────────────────────────────────────

    const AVATAR_CDN = 'https://cdn.fishtank.live/avatars/';
    const PROFILE_CDN = 'https://cdn.fishtank.live/images/';
    const TTS_CDN = 'https://cdn.fishtank.live/tts/';
    const SFX_CDN = 'https://cdn.fishtank.live/sfx/';

    function avatarUrl(filename) {
        if (!filename) return null;
        // Default profile images live under /images/, avatars under /avatars/
        if (filename === 'profile-small.gif') return PROFILE_CDN + filename;
        return AVATAR_CDN + filename;
    }

    function ttsAudioUrl(audioId) {
        if (!audioId) return null;
        return `${TTS_CDN}${audioId}.mp3`;
    }

    function sfxAudioUrl(audioFile) {
        if (!audioFile) return null;
        return SFX_CDN + audioFile;
    }

    // ── Role styling ────────────────────────────────────────────────────
    // Matches the site's own chat styling for each role type.

    const ROLE_STYLES = {
        staff: {
            bg: 'bg-lime-300/5',
            textClass: 'font-bold text-lime-400',
        },
        mod: {
            bg: 'bg-blue-300/5',
            textClass: 'font-medium text-blue-400',
        },
        fish: {
            bg: 'bg-green-300/5',
            textClass: 'font-regular text-green-500',
        },
        grandMarshal: {
            bg: 'bg-red-300/5',
            textClass: 'font-regular text-red-600',
        },
        epic: {
            bg: 'bg-amber/10',
            textClass: 'font-regular text-amber-300',
        },
    };

    // ── Shared element builders ─────────────────────────────────────────

    /**
     * Build a clickable username span that inserts an @mention on click.
     * Styled to match the site: inline-flex font-bold mr-1 select-none.
     */
    function usernameSpan(displayName, colour) {
        const span = document.createElement('div');
        span.className = colour
            ? 'cursor-pointer inline-flex font-bold mr-1 select-none'
            : 'cursor-pointer inline-flex font-bold mr-1 select-none text-orange-400';
        span.textContent = displayName;
        if (colour) span.style.color = colour;
        span.addEventListener('click', () => mentionUser(displayName));
        return span;
    }

    /**
     * Build a small avatar image wrapped in a button, matching the site's chat style.
     */
    function avatarImg(filename) {
        const url = avatarUrl(filename);
        if (!url) return null;
        const wrapper = document.createElement('div');
        wrapper.className = 'relative flex-shrink-0';
        wrapper.style.cssText = 'width: 28px; height: 28px;';

        const img = document.createElement('img');
        img.src = url;
        img.className = 'w-full h-full rounded-md drop-shadow-md object-contain select-none bg-dark/25 border-1 border-light-400/25';
        img.width = 32;
        img.height = 32;
        img.loading = 'lazy';
        img.draggable = false;

        wrapper.appendChild(img);
        return wrapper;
    }

    /**
     * Build a clan tag badge matching the site's chat style.
     */
    function clanBadge(clan) {
        if (!clan) return null;
        const badge = document.createElement('span');
        badge.className = 'font-secondary text-xs mr-1 px-1 rounded select-none inline-flex items-center bg-white/10 text-light-400/75';
        badge.textContent = clan;
        return badge;
    }

    /**
     * Build an endorsement badge (e.g. "TWIN", "LAND").
     * Styled similarly to the site's endorsement badges.
     */
    function endorsementBadge(endorsement) {
        if (!endorsement) return null;
        const badge = document.createElement('span');
        badge.className = 'font-secondary text-xs mr-1 px-1 rounded select-none inline-flex items-center bg-dark-400/75 text-light-text/60';
        badge.textContent = endorsement;
        return badge;
    }

    /**
     * Build a chat room badge (e.g. "SP", "XL").
     * Only shown for non-Global rooms to indicate where the message came from.
     */
    function chatRoomBadge(chatRoom) {
        if (!chatRoom || chatRoom === 'Global') return null;
        const badge = document.createElement('span');
        badge.className = 'font-secondary text-[10px] mr-1 px-1 rounded select-none inline-flex items-center bg-primary-500/20 text-primary-400/90';
        // Short labels to save space
        badge.textContent = chatRoom === 'Season Pass' ? 'SP'
            : chatRoom === 'Season Pass XL' ? 'XL'
                : chatRoom;
        badge.title = chatRoom;
        return badge;
    }

    /**
     * Build a timestamp div matching the site's chat style.
     * Positioned at bottom right of the row.
     */
    function timeDiv(timestamp) {
        const div = document.createElement('div');
        div.className = 'font-secondary text-xs text-light-400/50 leading-none tracking-wide text-right mt-1 text-shadow-[1px_1px_0_#000000]';
        div.textContent = formatTimestamp(timestamp);
        return div;
    }

    /**
     * Build a standard log row container matching the site's chat message layout.
     * Structure: group > flex-col > [flex row (avatar + content)] + [timestamp]
     */
    function logRow(role) {
        const row = document.createElement('div');
        const bg = role && ROLE_STYLES[role] ? ROLE_STYLES[role].bg : '';
        row.className = `group flex flex-col p-1 md:p-2 hover:bg-white/5 ${bg}`;
        return row;
    }

    /**
     * Build the inline message content (username + message on the same line).
     * Matches the site's chat layout: leading-4, text-sm, text-shadow-chat.
     */
    function inlineContent() {
        const div = document.createElement('div');
        div.className = 'leading-4 3xl:leading-5 text-shadow-chat my-auto pb-1 text-sm 3xl:text-base';
        return div;
    }

    /**
     * Build message text as an inline span, matching the site's font-extralight style.
     * Parses @mentions into clickable links.
     */
    function messageSpan(text, role) {
        const span = document.createElement('span');
        const roleText = role && ROLE_STYLES[role] ? ROLE_STYLES[role].textClass : 'font-extralight text-light-text';
        span.className = roleText;
        span.style.wordBreak = 'break-word';
        span.style.lineBreak = 'auto';

        // Parse @mentions into clickable links
        const parts = text.split(/(@\w+)/g);
        for (const part of parts) {
            if (part.startsWith('@')) {
                const username = part.slice(1);
                const link = document.createElement('span');
                link.className = 'text-orange-400 font-medium cursor-pointer';
                link.textContent = part;
                link.addEventListener('click', () => mentionUser(username));
                span.appendChild(link);
            } else {
                span.appendChild(document.createTextNode(part));
            }
        }

        return span;
    }

    // Currently playing audio (so we can stop it when playing a new one)
    let currentAudio = null;

    /**
     * Build a play/stop button for audio playback.
     */
    function playButton(audioUrl) {
        const btn = document.createElement('button');
        btn.className = 'opacity-40 hover:opacity-100 hover:text-primary-400 cursor-pointer transition-opacity ml-1';
        btn.title = 'Play audio';
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>`;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();

            // Check if THIS button was the one playing before we reset everything
            const wasPlaying = btn.hasAttribute('data-ftl-playing');

            // If already playing something, stop it
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
                // Reset all play buttons back to play icon
                document.querySelectorAll('[data-ftl-playing]').forEach(el => {
                    el.removeAttribute('data-ftl-playing');
                    el.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>`;
                    el.title = 'Play audio';
                });
            }

            // If this button was already playing, we just stopped it — done
            if (wasPlaying) {
                btn.removeAttribute('data-ftl-playing');
                return;
            }

            // Play the audio
            const audio = new Audio(audioUrl);
            currentAudio = audio;
            btn.setAttribute('data-ftl-playing', '');
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
            btn.title = 'Stop audio';

            audio.play().catch(() => {
                // Autoplay blocked or file not found
                btn.removeAttribute('data-ftl-playing');
                btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>`;
                btn.title = 'Play audio';
                currentAudio = null;
            });

            audio.addEventListener('ended', () => {
                btn.removeAttribute('data-ftl-playing');
                btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>`;
                btn.title = 'Play audio';
                currentAudio = null;
            });
        });

        return btn;
    }

    // ── Log row builders ────────────────────────────────────────────────

    // -- TTS/SFX use their own compact layout (not chat-style) -----------

    /**
     * Build a compact log row for TTS/SFX entries.
     */
    function compactRow() {
        const row = document.createElement('div');
        row.className = 'flex gap-2 px-2 py-1.5 hover:bg-white/5';
        return row;
    }

    /**
     * Build a message body div for TTS/SFX (stacked below header).
     */
    function compactMessage(text) {
        const msg = document.createElement('div');
        msg.className = 'text-sm mt-0.5 opacity-75';
        msg.style.wordBreak = 'break-word';

        const parts = text.split(/(@\w+)/g);
        for (const part of parts) {
            if (part.startsWith('@')) {
                const username = part.slice(1);
                const link = document.createElement('span');
                link.className = 'text-orange-400 font-medium cursor-pointer hover:opacity-75';
                link.textContent = part;
                link.addEventListener('click', () => mentionUser(username));
                msg.appendChild(link);
            } else {
                msg.appendChild(document.createTextNode(part));
            }
        }

        return msg;
    }

    /**
     * Build a compact timestamp span (inline with header).
     */
    function compactTimeSpan(timestamp) {
        const span = document.createElement('span');
        span.className = 'text-[11px] opacity-30 ml-auto flex-shrink-0';
        span.textContent = formatTimestamp(timestamp);
        return span;
    }

    /**
     * Build a compact username span for TTS/SFX.
     */
    function compactUsernameSpan(displayName, colour) {
        const span = document.createElement('span');
        span.className = 'font-bold cursor-pointer hover:opacity-75 text-orange-400';
        span.textContent = displayName;
        span.addEventListener('click', () => mentionUser(displayName));
        return span;
    }

    function buildTtsRow(entry) {
        const row = compactRow();

        // Content column
        const content = document.createElement('div');
        content.className = 'flex flex-col flex-1 min-w-0';

        // Header: username · voice · room [play] timestamp
        const header = document.createElement('div');
        header.className = 'flex items-center gap-1 flex-wrap';

        header.appendChild(compactUsernameSpan(entry.displayName));

        const meta = document.createElement('span');
        meta.className = 'text-[11px] opacity-40';
        meta.textContent = `· ${entry.voice} · ${roomName(entry.room)}`;
        header.appendChild(meta);

        if (entry.clan) {
            const badge = clanBadge(entry.clan);
            if (badge) header.appendChild(badge);
        }

        const audioUrl = ttsAudioUrl(entry.audioId);
        if (audioUrl) header.appendChild(playButton(audioUrl));

        header.appendChild(compactTimeSpan(entry.timestamp));

        content.appendChild(header);
        content.appendChild(compactMessage(entry.message));

        row.appendChild(content);
        return row;
    }

    function buildSfxRow(entry) {
        const row = compactRow();

        const content = document.createElement('div');
        content.className = 'flex flex-col flex-1 min-w-0';

        const header = document.createElement('div');
        header.className = 'flex items-center gap-1 flex-wrap';

        header.appendChild(compactUsernameSpan(entry.displayName));

        const meta = document.createElement('span');
        meta.className = 'text-[11px] opacity-40';
        meta.textContent = `· ${roomName(entry.room)}`;
        header.appendChild(meta);

        if (entry.clan) {
            const badge = clanBadge(entry.clan);
            if (badge) header.appendChild(badge);
        }

        const audioUrl = sfxAudioUrl(entry.audioFile);
        if (audioUrl) header.appendChild(playButton(audioUrl));

        header.appendChild(compactTimeSpan(entry.timestamp));

        content.appendChild(header);
        content.appendChild(compactMessage(entry.message));

        row.appendChild(content);
        return row;
    }

    // -- Pings/Role/Admin use chat-style layout --------------------------

    function buildPingsRow(entry) {
        const role = entry.role || null;
        const row = logRow(role);

        // Top line: avatar + inline content
        const topLine = document.createElement('div');
        topLine.className = 'flex gap-1';

        const img = avatarImg(entry.avatar);
        if (img) topLine.appendChild(img);

        const content = inlineContent();

        const roomBadge = chatRoomBadge(entry.chatRoom);
        if (roomBadge) content.appendChild(roomBadge);

        if (entry.endorsement) {
            const ebadge = endorsementBadge(entry.endorsement);
            if (ebadge) content.appendChild(ebadge);
        }

        if (entry.clan) {
            const badge = clanBadge(entry.clan);
            if (badge) content.appendChild(badge);
        }

        content.appendChild(usernameSpan(entry.displayName, entry.colour));
        content.appendChild(messageSpan(entry.message, role));
        topLine.appendChild(content);
        row.appendChild(topLine);

        // Timestamp bottom right
        row.appendChild(timeDiv(entry.timestamp));

        return row;
    }

    function buildRoleRow(entry) {
        const role = entry.role || null;
        const row = logRow(role);

        // Top line: avatar + inline content
        const topLine = document.createElement('div');
        topLine.className = 'flex gap-1';

        const img = avatarImg(entry.avatar);
        if (img) topLine.appendChild(img);

        const content = inlineContent();

        const roomBadge = chatRoomBadge(entry.chatRoom);
        if (roomBadge) content.appendChild(roomBadge);

        if (entry.endorsement) {
            const ebadge = endorsementBadge(entry.endorsement);
            if (ebadge) content.appendChild(ebadge);
        }

        if (entry.clan) {
            const badge = clanBadge(entry.clan);
            if (badge) content.appendChild(badge);
        }

        content.appendChild(usernameSpan(entry.displayName, entry.colour));
        content.appendChild(messageSpan(entry.message, role));
        topLine.appendChild(content);
        row.appendChild(topLine);

        // Timestamp bottom right
        row.appendChild(timeDiv(entry.timestamp));

        return row;
    }

    function buildAdminRow(entry) {
        const row = document.createElement('div');
        row.className = 'group flex flex-col p-1 md:p-2 hover:bg-white/5';

        const topLine = document.createElement('div');
        topLine.className = 'flex gap-1';

        if (entry.imageUrl) {
            const wrapper = document.createElement('div');
            wrapper.className = 'relative flex-shrink-0';
            wrapper.style.cssText = 'width: 40px; height: 40px;';
            const img = document.createElement('img');
            img.src = entry.imageUrl;
            img.alt = entry.imageAlt || '';
            img.className = 'w-full h-full rounded-md object-contain';
            wrapper.appendChild(img);
            topLine.appendChild(wrapper);
        }

        const content = inlineContent();

        const titleSpan = document.createElement('span');
        titleSpan.className = 'font-bold text-primary-400 mr-1';
        titleSpan.textContent = entry.title || '(no title)';
        content.appendChild(titleSpan);

        if (entry.description) {
            const desc = document.createElement('div');
            desc.className = 'font-extralight text-light-text text-sm';
            desc.style.wordBreak = 'break-word';
            desc.textContent = entry.description;
            content.appendChild(desc);
        }

        topLine.appendChild(content);
        row.appendChild(topLine);

        // Timestamp bottom right
        row.appendChild(timeDiv(entry.timestamp));

        return row;
    }

    // ── Render functions (fill a container with log entries) ────────────

    function emptyMessage(text) {
        return `<div class="text-sm text-center font-light italic p-5 m-auto opacity-75">${text}</div>`;
    }

    function renderTtsLog(container, entries) {
        container.innerHTML = '';
        if (entries.length === 0) { container.innerHTML = emptyMessage('No TTS messages logged yet'); return; }
        [...entries].reverse().forEach(e => container.appendChild(buildTtsRow(e)));
    }

    function renderSfxLog(container, entries) {
        container.innerHTML = '';
        if (entries.length === 0) { container.innerHTML = emptyMessage('No SFX messages logged yet'); return; }
        [...entries].reverse().forEach(e => container.appendChild(buildSfxRow(e)));
    }

    function renderPingsLog(container, entries, currentUsername) {
        container.innerHTML = '';
        if (!currentUsername) { container.innerHTML = emptyMessage('Not logged in — pings cannot be detected'); return; }
        if (entries.length === 0) { container.innerHTML = emptyMessage('No pings logged yet'); return; }
        [...entries].reverse().forEach(e => container.appendChild(buildPingsRow(e)));
    }

    function renderRoleLog(container, entries, emptyMsg) {
        container.innerHTML = '';
        if (entries.length === 0) { container.innerHTML = emptyMessage(emptyMsg); return; }
        [...entries].reverse().forEach(e => container.appendChild(buildRoleRow(e)));
    }

    function renderAdminLog(container, entries) {
        container.innerHTML = '';
        if (entries.length === 0) { container.innerHTML = emptyMessage('No admin messages logged yet'); return; }
        [...entries].reverse().forEach(e => container.appendChild(buildAdminRow(e)));
    }

    /**
     * logging.js — Message log state and storage
     *
     * Manages all log arrays (TTS, SFX, pings, staff, mod, fish, admin),
     * handles persistence to localStorage via the SDK, and provides
     * live-update functions that prepend new entries to the visible
     * log panel if it's open.
     */


    // ── Storage keys ────────────────────────────────────────────────────

    const KEYS = {
        tts:    'tts-log',
        sfx:    'sfx-log',
        pings:  'pings-log',
        staff:  'staff-log',
        mod:    'mod-log',
        fish:   'fish-log',
        admin:  'admin-log',
        filter: 'admin-filter',
    };

    // ── Log arrays ──────────────────────────────────────────────────────

    let ttsLog     = [];
    let sfxLog     = [];
    let pingsLog   = [];
    let staffLog   = [];
    let modLog     = [];
    let fishLog    = [];
    let adminLog   = [];
    let adminFilter = [];
    let unreadPings = 0;
    let onPingCountChange = null;

    // ── Initialise (load from storage) ──────────────────────────────────

    function loadLogs() {
        ttsLog      = get(KEYS.tts)    || [];
        sfxLog      = get(KEYS.sfx)    || [];
        pingsLog    = get(KEYS.pings)  || [];
        staffLog    = get(KEYS.staff)  || [];
        modLog      = get(KEYS.mod)    || [];
        fishLog     = get(KEYS.fish)   || [];
        adminLog    = get(KEYS.admin)  || [];
        adminFilter = get(KEYS.filter) || [];
    }

    // ── Getters ─────────────────────────────────────────────────────────

    function getLog(type) {
        switch (type) {
            case 'tts':   return ttsLog;
            case 'sfx':   return sfxLog;
            case 'pings': return pingsLog;
            case 'staff': return staffLog;
            case 'mod':   return modLog;
            case 'fish':  return fishLog;
            case 'admin': return adminLog;
            default:      return [];
        }
    }

    function getAdminFilter() { return adminFilter; }

    function resetUnreadPings() {
        unreadPings = 0;
        if (onPingCountChange) onPingCountChange(0);
    }

    function setOnPingCountChange(callback) {
        onPingCountChange = callback;
    }

    // ── Size key mapping ────────────────────────────────────────────────

    function sizeSettingKey(type) {
        const map = {
            tts: 'ttsLogSize', sfx: 'sfxLogSize', pings: 'pingsLogSize',
            staff: 'staffLogSize', mod: 'modLogSize', fish: 'fishLogSize',
            admin: 'adminLogSize',
        };
        return map[type] || 'adminLogSize';
    }

    function storageKey(type) {
        return KEYS[type] || KEYS.admin;
    }

    function getMaxSize(type) {
        return Math.max(1, Math.min(1000, getSetting(sizeSettingKey(type)) || 200));
    }

    // ── Generic push + trim + save ──────────────────────────────────────

    function pushEntry(arr, entry, type) {
        arr.push(entry);
        const max = getMaxSize(type);
        if (arr.length > max) arr.splice(0, arr.length - max);
        set(storageKey(type), arr);
    }

    // ── Live update helper ──────────────────────────────────────────────
    // Checks if the log panel is open and the given log type is active.
    // If so, prepends the new row with a flash animation.

    function liveUpdate(type, rowElement) {
        const logPanel   = document.querySelector('[data-ftl-panel="logging"]');
        const activeBtn  = document.querySelector(`[data-ftl-log="${type}"]`);
        const logContent = document.querySelector('[data-ftl-log-content]');

        const visible = logPanel && !logPanel.classList.contains('hidden')
            && activeBtn && activeBtn.classList.contains('brightness-125')
            && logContent;

        if (!visible) return;

        const empty = logContent.querySelector('.italic');
        if (empty) empty.remove();

        rowElement.classList.add('ftl-flash');
        logContent.prepend(rowElement);

        const max = getMaxSize(type);
        while (logContent.children.length > max) {
            logContent.removeChild(logContent.lastChild);
        }
    }

    // ── Public logging functions ────────────────────────────────────────

    function logTts(msg) {
        // Deduplicate across tabs
        const messageId = msg.audioId || null;
        if (messageId && ttsLog.some(e => e.audioId === messageId)) return;

        const entry = {
            displayName: msg.username || '???',
            message: msg.message,
            voice: msg.voice || '?',
            room: msg.room || '?',
            audioId: msg.audioId || null,
            clan: msg.clanTag || null,
            timestamp: Date.now(),
        };
        pushEntry(ttsLog, entry, 'tts');
        liveUpdate('tts', buildTtsRow(entry));
    }

    function logSfx(msg) {
        // Deduplicate across tabs — use audioFile as unique key
        const sfxKey = msg.audioFile || null;
        if (sfxKey && sfxLog.some(e => e.audioFile === sfxKey)) return;

        const entry = {
            displayName: msg.username || '???',
            message: msg.message,
            room: msg.room || '?',
            audioFile: msg.audioFile || null,
            clan: msg.clanTag || null,
            timestamp: Date.now(),
        };
        pushEntry(sfxLog, entry, 'sfx');
        liveUpdate('sfx', buildSfxRow(entry));
    }

    function logPing(msg) {
        // Deduplicate across tabs — both tabs receive the same message
        // via their own socket and write to the same localStorage
        const messageId = msg.raw?.id || null;
        if (messageId && pingsLog.some(e => e.messageId === messageId)) return;

        const entry = {
            displayName: msg.username || '???',
            message: msg.message,
            colour: msg.colour || null,
            avatar: msg.avatar || null,
            endorsement: msg.endorsement || null,
            role: msg.role || null,
            chatRoom: msg.chatRoom || 'Global',
            messageId,
            timestamp: Date.now(),
        };
        pushEntry(pingsLog, entry, 'pings');
        liveUpdate('pings', buildPingsRow(entry));

        unreadPings++;
        if (onPingCountChange) onPingCountChange(unreadPings);
    }

    function logRoleMessage(msg) {
        const role = msg.role; // 'staff' | 'mod' | 'fish'
        const arr = role === 'staff' ? staffLog : role === 'mod' ? modLog : fishLog;
        const type = role;

        // Deduplicate across tabs
        const messageId = msg.raw?.id || null;
        if (messageId && arr.some(e => e.messageId === messageId)) return;

        const entry = {
            displayName: msg.username || '???',
            message: msg.message,
            colour: msg.colour || null,
            avatar: msg.avatar || null,
            clan: msg.clan || null,
            endorsement: msg.endorsement || null,
            role,
            chatRoom: msg.chatRoom || 'Global',
            messageId,
            timestamp: Date.now(),
        };
        pushEntry(arr, entry, type);
        liveUpdate(type, buildRoleRow(entry));
    }

    function logAdminToast(toast) {
        const entry = {
            title:       toast.title,
            description: toast.description || null,
            imageUrl:    toast.imageUrl || null,
            imageAlt:    toast.imageAlt || null,
            timestamp:   Date.now(),
        };

        // Check admin filter
        if (adminFilter.length > 0) {
            const combined = `${entry.title || ''} ${entry.description || ''}`.toLowerCase();
            if (adminFilter.some(term => combined.includes(term.toLowerCase()))) return;
        }

        pushEntry(adminLog, entry, 'admin');
        liveUpdate('admin', buildAdminRow(entry));
    }

    // ── Clear / resize ──────────────────────────────────────────────────

    function clearLog(type) {
        const arr = getLog(type);
        arr.length = 0;
        set(storageKey(type), arr);
    }

    function resizeLog(type, newSize) {
        const arr = getLog(type);
        if (arr.length > newSize) {
            arr.splice(0, arr.length - newSize);
            set(storageKey(type), arr);
        }
    }

    // ── Render a log type into a container ──────────────────────────────

    function renderLog(type, container, currentUsername) {
        switch (type) {
            case 'tts':   renderTtsLog(container, ttsLog); break;
            case 'sfx':   renderSfxLog(container, sfxLog); break;
            case 'pings': renderPingsLog(container, pingsLog, currentUsername); break;
            case 'staff': renderRoleLog(container, staffLog, 'No staff messages logged yet'); break;
            case 'mod':   renderRoleLog(container, modLog, 'No mod messages logged yet'); break;
            case 'fish':  renderRoleLog(container, fishLog, 'No fish messages logged yet'); break;
            case 'admin': renderAdminLog(container, adminLog); break;
        }
    }

    // ── Admin filter management ─────────────────────────────────────────

    function addFilterTerm(term) {
        if (!term || adminFilter.includes(term)) return false;
        adminFilter.push(term);
        set(KEYS.filter, adminFilter);
        return true;
    }

    function removeFilterTerm(index) {
        adminFilter.splice(index, 1);
        set(KEYS.filter, adminFilter);
    }

    /**
     * crafting.js — Crafting recipe management and modal hints
     *
     * Handles fetching recipes from fishtank.guru, caching them,
     * injecting hints into the crafting bench modal, showing recipe
     * info in the use-item modal, and powering the recipe search
     * in the settings panel.
     *
     * Both hint functions use a poll-for-modal pattern because the
     * modalOpen CustomEvent fires BEFORE React renders the #modal
     * element into the DOM. We poll briefly (every 100ms, max 2s)
     * for #modal to appear, then attach a targeted MutationObserver
     * on the modal element (NOT body) to wait for the specific
     * content we need.
     */


    const RECIPE_URL = 'https://fishtank.guru/resources/recipes.json';
    const RECIPE_CACHE_KEY = 'crafting-recipes';

    let craftingRecipes = null;

    // ── Init ────────────────────────────────────────────────────────────

    function loadRecipesFromCache() {
        const cached = get(RECIPE_CACHE_KEY);
        if (cached) {
            craftingRecipes = cached;
        }
    }

    function fetchRecipes() {
        return fetch(RECIPE_URL)
            .then(r => r.json())
            .then(data => {
                craftingRecipes = data;
                set(RECIPE_CACHE_KEY, data);
            })
            .catch(() => {
                if (craftingRecipes) {
                    console.warn('[FTL Extended] Could not fetch recipes, using cached version');
                } else {
                    console.warn('[FTL Extended] Could not fetch recipes and no cache available');
                }
            });
    }

    // ── Helper: wait for #modal to exist ────────────────────────────────
    // Polls every 100ms for up to 2 seconds. Calls callback with the
    // modal element when found. Cleans up on modalClose.

    function waitForModal(callback) {
        let attempts = 0;
        const poll = setInterval(() => {
            attempts++;
            const modal = document.getElementById('modal');
            if (modal) {
                clearInterval(poll);
                callback(modal);
            } else if (attempts > 20) {
                clearInterval(poll);
            }
        }, 100);

        // Clean up if modal closes before we find it
        document.addEventListener('modalClose', () => clearInterval(poll), { once: true });
    }

    // ── Crafting Bench Hints ────────────────────────────────────────────
    // Called when the crafting bench modal opens. Waits for the modal to
    // render, then observes it (NOT body) for the item row to appear.

    function initCraftingHints() {
        if (!craftingRecipes) return;
        if (!getSetting('showRecipesWhenCrafting')) return;

        waitForModal((modal) => {
            // Watch the modal element for the item row to appear
            const readyObserver = new MutationObserver(() => {
                const itemRow = modal.querySelector('.flex.items-center.justify-center.gap-5');
                if (!itemRow) return;
                readyObserver.disconnect();

                modal.querySelector('[data-ftl-sdk="craft-hints"]')?.remove();

                const hintContainer = document.createElement('div');
                hintContainer.setAttribute('data-ftl-sdk', 'craft-hints');
                hintContainer.className = 'mt-2 px-1';
                itemRow.insertAdjacentElement('afterend', hintContainer);

                function getSelectedItems() {
                    return [...itemRow.querySelectorAll('.font-secondary')]
                        .map(el => el.textContent.trim())
                        .filter(text => text && text !== 'Select Item');
                }

                let isUpdating = false;

                function updateHints() {
                    if (isUpdating) return;
                    isUpdating = true;

                    const selected = getSelectedItems();
                    hintContainer.innerHTML = '';

                    if (selected.length === 0) {
                        isUpdating = false;
                        return;
                    }

                    if (selected.length === 2) {
                        const sorted = [...selected].sort();
                        const match = craftingRecipes.find(r => {
                            const s = [...r.ingredients].sort();
                            return s[0] === sorted[0] && s[1] === sorted[1];
                        });

                        if (match) {
                            hintContainer.innerHTML = `
                            <div class="flex items-center gap-1 text-xs bg-secondary-600/20 border-1 border-secondary-600/40 rounded-md px-2 py-1.5">
                                <span class="opacity-60">Result:</span>
                                <span class="font-bold text-secondary-400">${match.result}</span>
                            </div>
                        `;
                        } else {
                            hintContainer.innerHTML = `
                            <div class="text-xs opacity-40 text-center py-1">No recipe found for these items</div>
                        `;
                        }
                    } else if (selected.length === 1) {
                        const item = selected[0];
                        const matches = craftingRecipes.filter(r => r.ingredients.includes(item));

                        if (matches.length === 0) {
                            hintContainer.innerHTML = `
                            <div class="text-xs opacity-40 text-center py-1">No known recipes for ${item}</div>
                        `;
                        } else {
                            const rows = matches.map(r => {
                                const other = r.ingredients.find(i => i !== item) || item;
                                return `
                                <div class="flex items-center gap-1 text-xs py-1 border-b-1 border-dark-400/25 last:border-0">
                                    <span class="font-medium opacity-70">${item}</span>
                                    <span class="opacity-40">+</span>
                                    <span class="font-medium">${other}</span>
                                    <span class="opacity-40 mx-1">=</span>
                                    <span class="font-bold text-primary-400">${r.result}</span>
                                </div>
                            `;
                            }).join('');

                            hintContainer.innerHTML = `
                            <div class="border-1 border-dark-400/50 rounded-md px-2 py-1 max-h-[100px] overflow-y-auto" style="scrollbar-width: thin;">
                                <div class="text-xs opacity-40 mb-1">Known recipes for ${item}:</div>
                                ${rows}
                            </div>
                        `;
                        }
                    }

                    isUpdating = false;
                }

                updateHints();

                // Watch the item row (targeted, NOT body) for selection changes
                const craftObserver = new MutationObserver(updateHints);
                craftObserver.observe(itemRow, { childList: true, subtree: true });
                document.addEventListener('modalClose', () => craftObserver.disconnect(), { once: true });
            });

            readyObserver.observe(modal, { childList: true, subtree: true });
            document.addEventListener('modalClose', () => readyObserver.disconnect(), { once: true });
        });
    }

    // ── Use Item Hints ──────────────────────────────────────────────────
    // Called when the use-item modal opens. Waits for the modal to render,
    // then observes it (NOT body) for the Use button to appear.

    function initUseItemHints() {
        if (!craftingRecipes) return;
        if (!getSetting('showRecipeWhenConsuming')) return;

        waitForModal((modal) => {
            if (modal.querySelector('[data-ftl-sdk="use-hints"]')) return;

            // Watch the modal (NOT body) for the Use button to appear
            const readyObserver = new MutationObserver(() => {
                const useBtn = [...modal.querySelectorAll('button')].find(b => b.textContent.trim() === 'Use');
                if (!useBtn) return;
                readyObserver.disconnect();

                const nameEl = modal.querySelector('.font-secondary');
                const item = nameEl?.textContent?.trim();
                if (!item) return;

                const matches = craftingRecipes.filter(r => r.ingredients.includes(item));
                if (matches.length === 0) return;

                const btnRow = useBtn.closest('.flex.w-full.gap-2');
                if (!btnRow) return;

                const hintContainer = document.createElement('div');
                hintContainer.setAttribute('data-ftl-sdk', 'use-hints');
                hintContainer.className = 'mb-2 mt-3';

                const rows = matches.map(r => {
                    const other = r.ingredients.find(i => i !== item) || item;
                    return `
                    <div class="flex items-center gap-1 text-xs py-1 border-b-1 border-dark-400/25 last:border-0">
                        <span class="font-medium opacity-70">${item}</span>
                        <span class="opacity-40">+</span>
                        <span class="font-medium">${other}</span>
                        <span class="opacity-40 mx-1">=</span>
                        <span class="font-bold text-primary-400">${r.result}</span>
                    </div>
                `;
                }).join('');

                hintContainer.innerHTML = `
                <div class="border-1 border-dark-400/50 rounded-md px-2 py-1 max-h-[80px] overflow-y-auto" style="scrollbar-width: thin;">
                    <div class="text-xs opacity-40 mb-1">Known recipes using ${item}:</div>
                    ${rows}
                </div>
            `;

                btnRow.closest('.flex.flex-col')?.insertAdjacentElement('beforebegin', hintContainer);
            });

            readyObserver.observe(modal, { childList: true, subtree: true });
            document.addEventListener('modalClose', () => readyObserver.disconnect(), { once: true });
        });
    }

    // ── Recipe search (for settings panel) ──────────────────────────────

    function renderRecipeResults(query, container) {
        container.innerHTML = '';
        if (!query) {
            container.classList.add('hidden');
            return;
        }

        if (!craftingRecipes) {
            container.classList.remove('hidden');
            container.innerHTML = '<div class="text-xs opacity-50 text-center py-2">Recipes not loaded yet, try again shortly</div>';
            return;
        }

        const q = query.toLowerCase();
        const matched = craftingRecipes.filter(recipe =>
            recipe.ingredients.some(i => i.toLowerCase().includes(q)) ||
            recipe.result.toLowerCase().includes(q)
        );

        if (matched.length === 0) {
            container.classList.remove('hidden');
            container.innerHTML = '<div class="text-xs opacity-50 text-center py-2">No recipes found</div>';
            return;
        }

        container.classList.remove('hidden');

        matched.forEach(recipe => {
            const [a, b] = recipe.ingredients;
            const first = b.toLowerCase().includes(q) ? b : a;
            const second = b.toLowerCase().includes(q) ? a : b;

            const row = document.createElement('div');
            row.className = 'flex items-center gap-1 text-xs py-1 border-b-1 border-dark-400/25';
            row.innerHTML = `
            <span class="font-medium">${first}</span>
            <span class="opacity-40">+</span>
            <span class="font-medium">${second}</span>
            <span class="opacity-40 mx-1">=</span>
            <span class="font-bold text-primary-400">${recipe.result}</span>
        `;
            container.appendChild(row);
        });
    }

    /**
     * modals.js — Modal builders and helpers
     *
     * Contains the FTL Extended settings modal (the big tabbed panel),
     * the dropdown button injector, and a generic modal-open helper.
     *
     * NO body-level MutationObservers. The dropdown button is injected
     * via a click listener on the profile avatar area, and modals are
     * detected via the SDK's modalOpen event.
     */


    let currentUsername$1 = null;
    let activeModalName = null;
    let userPasses = { seasonPass: false, seasonPassXL: false };

    function setCurrentUsername(name) {
        currentUsername$1 = name;
    }

    function setUserPasses(passes) {
        userPasses = passes;
    }

    function setActiveModal(name) {
        activeModalName = name;
    }

    // ── Firefox-safe event dispatch ──────────────────────────────────────
    // Firefox content scripts run in a separate JS realm. CustomEvent detail
    // objects created here are not accessible from the page context, causing
    // "Permission denied to access property" errors. cloneInto() copies the
    // detail into the page realm so NextJS handlers can read it.

    function dispatchPageEvent(eventName, detail = {}) {
        const safeDetail = typeof cloneInto === 'function'
            ? cloneInto(detail, document.defaultView) : detail;
        document.dispatchEvent(new CustomEvent(eventName, { detail: safeDetail }));
    }

    // ── Generic modal open helper ───────────────────────────────────────

    function openModal(modalName, data = {}) {
        // Toggle: if this modal is already open, close it
        if (document.getElementById('modal') && activeModalName === modalName) {
            dispatchPageEvent('modalClose');
            return;
        }

        if (document.getElementById('modal')) {
            dispatchPageEvent('modalClose');
            setTimeout(() => {
                dispatchPageEvent('modalOpen', { modal: modalName, data: JSON.stringify(data) });
            }, 50);
        } else {
            dispatchPageEvent('modalOpen', { modal: modalName, data: JSON.stringify(data) });
        }
    }

    // ── Dropdown button injection ───────────────────────────────────────
    // Injects our "FTL Extended" button into the profile dropdown.
    // Called from a click listener on the top-right profile area —
    // NOT from a body observer.

    function tryInjectDropdownButton() {
        const dropdown = document.querySelector('.fixed.top-0.right-\\[16px\\]');
        if (!dropdown || dropdown.querySelector('[data-ftl-sdk="dropdown-btn"]')) return;

        const buttons = dropdown.querySelectorAll('button');
        const billingBtn = [...buttons].find(btn => btn.textContent.trim().includes('Billing'));
        if (!billingBtn) return;

        const btn = document.createElement('button');
        btn.setAttribute('data-ftl-sdk', 'dropdown-btn');
        btn.className = 'flex items-center w-full rounded-md gap-2 px-2 py-1 font-medium cursor-pointer drop-shadow-[2px_2px_0_#00000075] hover:text-primary-400 hover:bg-light/5';
        btn.innerHTML = `
        <div class="flex items-center text-primary">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="1em" height="1em">
                <rect x="7" y="6" width="10" height="2"></rect>
                <rect x="6" y="8" width="12" height="2"></rect>
                <rect x="6" y="10" width="2" height="2"></rect>
                <rect x="11" y="10" width="2" height="2"></rect>
                <rect x="16" y="10" width="2" height="2"></rect>
                <rect x="13" y="12" width="3" height="2"></rect>
                <rect x="8" y="12" width="3" height="2"></rect>
                <rect x="9" y="14" width="6" height="1"></rect>
                <rect x="10" y="17" width="4" height="1"></rect>
                <rect x="11" y="15" width="1" height="1"></rect>
                <rect x="13" y="15" width="1" height="1"></rect>
                <rect x="12" y="16" width="1" height="1"></rect>
                <rect x="10" y="16" width="1" height="1"></rect>
                <rect x="2" y="0" width="2" height="2"></rect>
                <rect x="0" y="2" width="4" height="2"></rect>
                <rect x="4" y="4" width="2" height="2"></rect>
                <rect x="20" y="0" width="2" height="2"></rect>
                <rect x="20" y="2" width="4" height="2"></rect>
                <rect x="18" y="4" width="2" height="2"></rect>
                <rect x="0" y="20" width="4" height="2"></rect>
                <rect x="2" y="22" width="2" height="2"></rect>
                <rect x="4" y="18" width="2" height="2"></rect>
                <rect x="6" y="16" width="2" height="2"></rect>
                <rect x="20" y="20" width="4" height="2"></rect>
                <rect x="20" y="22" width="2" height="2"></rect>
                <rect x="18" y="18" width="2" height="2"></rect>
                <rect x="16" y="16" width="2" height="2"></rect>
            </svg>
        </div>
        <div class="flex items-center">FTL Extended</div>
    `;
        btn.addEventListener('click', openSettingsModal);
        billingBtn.insertAdjacentElement('beforebegin', btn);
    }

    // ── Ping button in chat header ──────────────────────────────────────
    // Injects a small @ button into the chat header bar (next to the
    // megaphone button). Clicking it opens FTL Extended on the pings log.

    function tryInjectPingButton() {
        if (!getSetting('enablePingIndicator')) return;

        // Find the chat header — it contains "Chat" text and the "Global" pill
        const chatLabels = document.querySelectorAll('span.font-bold.text-dark-text');
        let chatHeader = null;
        for (const label of chatLabels) {
            if (label.textContent.trim() === 'Chat') {
                chatHeader = label.closest('.flex.items-center.px-1');
                break;
            }
        }
        if (!chatHeader) return;

        // Already injected
        if (chatHeader.querySelector('[data-ftl-sdk="ping-btn"]')) return;

        // Find the button container on the right side of the header
        const btnContainer = chatHeader.querySelector('.flex.items-center.gap-0\\.5');
        if (!btnContainer) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'relative translate-y-[2px]';
        wrapper.setAttribute('data-ftl-sdk', 'ping-btn');

        const btn = document.createElement('button');
        // Starts dimmed — opacity-50 + saturate-0
        btn.className = 'bg-gradient-to-r from-primary-400 to-primary-500/90 active:to-primary-600/75 p-0.5 inline-flex items-center justify-center cursor-pointer rounded-md hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary pointer-events-auto transition-[opacity,filter] duration-300 opacity-50 saturate-0';
        btn.type = 'button';
        btn.title = 'View pings';
        btn.innerHTML = `
        <div class="text-light-text bg-gradient-to-t from-primary-400 to-primary-500 active:bg-gradient-to-b active:from-primary-500 active:to-primary-300 border-light/25 active:border-light/15 p-0.5 rounded-sm">
            <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 5.58 2 10c0 2.24 1.12 4.26 2.92 5.72-.18.66-.52 1.56-1.18 2.56-.22.34-.02.76.36.82 1.76.26 3.64-.12 4.92-.94.62.12 1.28.18 1.98.18 5.52 0 10-3.58 10-8S17.52 2 12 2zm-2 11.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
            </svg>
        </div>
    `;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openSettingsModalToTab('logging', 'pings');
        });

        wrapper.appendChild(btn);
        btnContainer.insertBefore(wrapper, btnContainer.firstChild);
    }

    /**
     * Update the ping button state — dimmed when no unread, lit when unread.
     * Called by the ping count change callback from logging.js.
     */
    function updatePingBadge(count) {
        const wrapper = document.querySelector('[data-ftl-sdk="ping-btn"]');
        const btn = wrapper?.querySelector('button');
        if (!btn) return;

        if (count > 0) {
            btn.classList.remove('opacity-50', 'saturate-0');
        } else {
            btn.classList.add('opacity-50', 'saturate-0');
        }
    }

    // ── Settings modal ──────────────────────────────────────────────────

    let pendingTab = null;
    let pendingLog = null;

    function openSettingsModal() {
        // Toggle: if our settings modal is already open, close it
        if (document.getElementById('modal') && activeModalName === 'ftlExtended') {
            dispatchPageEvent('modalClose');
            return;
        }
        pendingTab = null;
        pendingLog = null;
        openSettingsModalInternal();
    }

    function openSettingsModalToTab(tabName, logType = null) {
        pendingTab = tabName;
        pendingLog = logType;
        if (logType === 'pings') resetUnreadPings();
        openSettingsModalInternal();
    }

    function openSettingsModalInternal() {
        if (document.getElementById('modal')) {
            dispatchPageEvent('modalClose');
            setTimeout(openSettingsModalInternal, 50);
            return;
        }

        dispatchPageEvent('modalOpen', {
            modal: 'ftlExtended',
            data: JSON.stringify({}),
        });

        // One-shot observer on body to find the modal element, then disconnect
        const observer = new MutationObserver(() => {
            const modal = document.getElementById('modal');
            if (!modal) return;
            observer.disconnect();

            setTimeout(() => buildSettingsContent(modal), 50);
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function buildSettingsContent(modal) {
        const card = modal.querySelector('.relative');
        if (!card) return;

        const wrapper = modal.querySelector('.absolute.w-\\[400px\\]');
        if (wrapper) wrapper.classList.replace('w-[400px]', 'w-[600px]');

        const contentArea = document.createElement('div');
        contentArea.setAttribute('data-ftl-sdk', 'settings');
        contentArea.innerHTML = `
        <div class="text-center font-bold mb-3 capitalize">FTL Extended</div>

        <!-- Tab bar -->
        <div class="flex gap-1 md:gap-3 mb-4">
            <button data-ftl-tab="general" class="bg-gradient-to-r from-primary-400 to-primary-500/90 h-[32px] p-0.5 inline-flex items-center justify-center text-center rounded-md cursor-pointer hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary w-full outline-1 outline-tertiary brightness-110" type="button">
                <div class="text-light-text bg-gradient-to-t from-primary-400 to-primary-500 text-shadow-md border-light/25 text-md p-1 flex justify-center items-center h-full w-full m-auto rounded-md border-2 text-center font-medium whitespace-nowrap leading-none">General</div>
            </button>
            <button data-ftl-tab="crafting" class="bg-gradient-to-r from-secondary-500 to-secondary-600/75 h-[32px] p-0.5 inline-flex items-center justify-center text-center rounded-md cursor-pointer hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary w-full brightness-75" type="button">
                <div class="text-light-text bg-gradient-to-t from-secondary-400 to-secondary-500 text-shadow-md border-light/25 text-md p-1 flex justify-center items-center h-full w-full m-auto rounded-md border-2 text-center font-medium whitespace-nowrap leading-none">Crafting</div>
            </button>
            <button data-ftl-tab="logging" class="bg-gradient-to-r from-tertiary-500 to-tertiary-600/75 h-[32px] p-0.5 inline-flex items-center justify-center text-center rounded-md cursor-pointer hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary w-full brightness-75" type="button">
                <div class="text-light-text bg-gradient-to-t from-tertiary-400 to-tertiary-500 text-shadow-md border-light/25 text-md p-1 flex justify-center items-center h-full w-full m-auto rounded-md border-2 text-center font-medium whitespace-nowrap leading-none">Logging</div>
            </button>
            <button data-ftl-tab="chat" class="bg-gradient-to-r from-purple-500 to-purple-600/75 h-[32px] p-0.5 inline-flex items-center justify-center text-center rounded-md cursor-pointer hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary w-full brightness-75" type="button">
                <div class="text-light-text bg-gradient-to-t from-purple-400 to-purple-500 text-shadow-md border-light/25 text-md p-1 flex justify-center items-center h-full w-full m-auto rounded-md border-2 text-center font-medium whitespace-nowrap leading-none">Chat</div>
            </button>
        </div>

        <!-- General tab -->
        <div data-ftl-panel="general">
            ${toggleRow('Auto Close Season Pass Popup', 'autoCloseSeasonPassPopup', getSetting('autoCloseSeasonPassPopup'))}
            ${toggleRow('Keyboard Shortcuts', 'enableKeyboardShortcuts', getSetting('enableKeyboardShortcuts'), 'Q P H X C M S &nbsp;(E always works)')}
            ${toggleRow('Reveal Hidden Clickable Zones', 'revealHiddenZones', getSetting('revealHiddenZones'), 'Highlights secret zones on the video player')}
            ${toggleRow('Enhanced Theatre Mode', 'enhancedTheatreMode', getSetting('enhancedTheatreMode'), 'Replaces site theatre mode (T)')}
            ${toggleRow('Video Stutter Improver', 'videoStutterImprover', getSetting('videoStutterImprover'), 'Auto fixes the video when stutters causes playback issues')}
            ${toggleRow('Inventory Search', 'enableInventorySearch', getSetting('enableInventorySearch'), 'Search items in inventory and crafting')}
            ${toggleRow('Ping Indicator', 'enablePingIndicator', getSetting('enablePingIndicator'), 'Show unread ping button in chat header')}
            ${userPasses.seasonPass ? toggleRow('Monitor Season Pass Chat', 'monitorSeasonPass', getSetting('monitorSeasonPass'), 'Log messages and pings from Season Pass room') : ''}
            ${userPasses.seasonPassXL ? toggleRow('Monitor Season Pass XL Chat', 'monitorSeasonPassXL', getSetting('monitorSeasonPassXL'), 'Log messages and pings from Season Pass XL room') : ''}
        </div>

        <!-- Crafting tab -->
        <div data-ftl-panel="crafting" class="hidden">
            ${toggleRow('Show Recipes When Crafting', 'showRecipesWhenCrafting', getSetting('showRecipesWhenCrafting'))}
            ${toggleRow('Show Recipes When Consuming', 'showRecipeWhenConsuming', getSetting('showRecipeWhenConsuming'))}
            <input data-ftl-craft-search type="text" placeholder="Search recipes..." class="font-regular text-md leading-none w-full h-[32px] p-1 mt-2 shadow-md shadow-dark/15 rounded-md bg-gradient-to-t border-1 text-light-text text-shadow-input focus:shadow-lg focus-visible:outline-1 focus-visible:outline-tertiary from-dark-500 via-dark-500 to-dark-600 border-light/50 outline-1 outline-dark/25 mb-2" />
            <div data-ftl-craft-results class="hidden overflow-y-auto border-1 border-dark-400/50 rounded-md px-2 py-1" style="max-height: 400px; scrollbar-width: thin;"></div>
            <div class="text-xs opacity-40 text-center mt-2">Powered by <a href="https://fishtank.guru" target="_blank" class="cursor-pointer text-primary font-heavy hover:underline">fishtank.guru</a></div>
        </div>

        <!-- Logging tab -->
        <div data-ftl-panel="logging" class="hidden">
            <div class="flex gap-1 mb-3">
                ${logPill('admin', 'Admin')}
                ${logPill('staff', 'Staff')}
                ${logPill('mod', 'Mod')}
                ${logPill('fish', 'Fish')}
                ${logPill('pings', 'Pings')}
                ${logPill('tts', 'TTS')}
                ${logPill('sfx', 'SFX')}
            </div>
            <div data-ftl-log-size-row class="hidden flex items-center gap-2 mb-3 text-xs opacity-60">
                <span>Log size (max 1000)</span>
                <input data-ftl-log-size type="number" min="1" max="1000" value="${getSetting('ttsLogSize')}" class="w-[64px] text-center font-regular leading-none h-[24px] p-1 rounded-md bg-gradient-to-t border-1 text-light-text text-shadow-input focus:shadow-lg focus-visible:outline-1 focus-visible:outline-tertiary from-dark-500 via-dark-500 to-dark-600 border-light/50 outline-1 outline-dark/25" />
                <button data-ftl-log-clear class="ml-auto cursor-pointer opacity-60 hover:opacity-100 hover:text-red-400 transition-all" type="button" title="Clear log">
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" width="16" height="16">
                        <rect x="9" y="0" width="6" height="2"></rect>
                        <rect x="7" y="2" width="2" height="2"></rect>
                        <rect x="15" y="2" width="2" height="2"></rect>
                        <rect x="2" y="4" width="20" height="2"></rect>
                        <rect x="4" y="6" width="2" height="16"></rect>
                        <rect x="18" y="6" width="2" height="16"></rect>
                        <rect x="4" y="22" width="14" height="2"></rect>
                        <rect x="9" y="8" width="1" height="12"></rect>
                        <rect x="14" y="8" width="1" height="12"></rect>
                    </svg>
                </button>
                <div data-ftl-log-clear-confirm class="hidden ml-auto flex items-center gap-2">
                    <span class="opacity-75">Sure?</span>
                    <button data-ftl-log-clear-yes class="cursor-pointer text-red-400 hover:opacity-100 font-bold" type="button">Yes</button>
                    <button data-ftl-log-clear-no class="cursor-pointer hover:opacity-100" type="button">No</button>
                </div>
            </div>
            <div data-ftl-log-content class="relative flex flex-col w-full bg-dark rounded-sm shadow-md bg-gradient-to-r from-dark-500 via-dark-600 to-dark-600 border-2 border-dark-300/50 overflow-y-auto text-light-text" style="height: 500px; max-height: 50dvh; overflow-x: hidden; scrollbar-width: thin;">
                <div class="text-sm text-center font-light italic p-5 m-auto opacity-75">Select a log type above</div>
            </div>
        </div>

        <!-- Chat tab -->
        <div data-ftl-panel="chat" class="hidden">
            ${toggleRow('Smart Anti-Spam Filtering', 'smartAntiSpam', getSetting('smartAntiSpam'), 'Removes spam, repeated messages, and flood copypastas from chat')}
        </div>

        <!-- Footer -->
        <div class="mt-4 pt-3 border-t-1 border-dark-400/50 text-xs font-secondary opacity-60 text-center">
            <div class="flex gap-1 font-bold justify-center flex-wrap">
                <span>Like this extension?</span>
                <span class="cursor-pointer text-primary font-heavy hover:underline" id="ftl-tip-link">TIP</span>
                <span class="opacity-40 mx-1">·</span>
                <span>Want to contribute?</span>
                <a class="cursor-pointer text-primary font-heavy hover:underline" href="https://github.com/BarryThePirate/FishtankLiveExtended" target="_blank">GITHUB</a>
            </div>
        </div>
    `;
        card.appendChild(contentArea);

        wireUpTabs(contentArea);
        wireUpToggles(contentArea);
        wireUpCraftingSearch(contentArea);
        wireUpLogging(contentArea);
        wireUpTipLink(contentArea);
    }

    // ── Tab switching ───────────────────────────────────────────────────

    function wireUpTabs(contentArea) {
        const tabs = contentArea.querySelectorAll('[data-ftl-tab]');
        const panels = contentArea.querySelectorAll('[data-ftl-panel]');

        function activateTab(tabName) {
            tabs.forEach(tab => {
                const isActive = tab.getAttribute('data-ftl-tab') === tabName;
                tab.classList.toggle('brightness-110', isActive);
                tab.classList.toggle('outline-1', isActive);
                tab.classList.toggle('outline-tertiary', isActive);
                tab.classList.toggle('brightness-75', !isActive);
            });
            panels.forEach(panel => {
                const isPanelActive = panel.getAttribute('data-ftl-panel') === tabName;
                panel.classList.toggle('hidden', !isPanelActive);
            });

            // Hide admin filter when not on logging/admin
            const filterPanel = contentArea.querySelector('[data-ftl-admin-filter]');
            if (filterPanel && tabName !== 'logging') filterPanel.classList.add('hidden');
        }

        tabs.forEach(tab => {
            tab.addEventListener('click', () => activateTab(tab.getAttribute('data-ftl-tab')));
        });

        activateTab(pendingTab || 'general');
    }

    // ── Toggles ─────────────────────────────────────────────────────────

    function wireUpToggles(contentArea) {
        contentArea.querySelectorAll('[data-ftl-toggle]').forEach(toggle => {
            const key = toggle.getAttribute('data-ftl-toggle');
            const knob = toggle.querySelector('div');
            toggle.addEventListener('click', () => {
                const newVal = !getSetting(key);
                updateSetting(key, newVal);
                knob.classList.toggle('left-[0px]', newVal);
                knob.classList.toggle('left-[calc(100%-16px)]', !newVal);

                // Immediately notify page-level chat filter when anti-spam is toggled
                if (key === 'smartAntiSpam') {
                    window.postMessage({ type: 'ftl-chat-filter-enabled', enabled: newVal }, '*');
                }
            });
        });
    }

    // ── Crafting search ─────────────────────────────────────────────────

    function wireUpCraftingSearch(contentArea) {
        const searchInput = contentArea.querySelector('[data-ftl-craft-search]');
        const resultsContainer = contentArea.querySelector('[data-ftl-craft-results]');
        if (searchInput && resultsContainer) {
            searchInput.addEventListener('input', () => {
                renderRecipeResults(searchInput.value.trim(), resultsContainer);
            });
        }
    }

    // ── Logging panel ───────────────────────────────────────────────────

    function wireUpLogging(contentArea) {
        const logBtns    = contentArea.querySelectorAll('[data-ftl-log]');
        const logContent = contentArea.querySelector('[data-ftl-log-content]');
        const sizeRow    = contentArea.querySelector('[data-ftl-log-size-row]');
        const sizeInput  = contentArea.querySelector('[data-ftl-log-size]');
        const clearBtn   = contentArea.querySelector('[data-ftl-log-clear]');
        const clearConfirm = contentArea.querySelector('[data-ftl-log-clear-confirm]');
        const clearYes   = contentArea.querySelector('[data-ftl-log-clear-yes]');
        const clearNo    = contentArea.querySelector('[data-ftl-log-clear-no]');

        let activeLogType = 'admin';

        function activateLog(logType) {
            activeLogType = logType;

            logBtns.forEach(btn => {
                const isActive = btn.getAttribute('data-ftl-log') === logType;
                btn.classList.toggle('brightness-125', isActive);
                btn.classList.toggle('brightness-50', !isActive);
            });

            sizeRow.classList.remove('hidden');
            const sizeKey = {
                tts: 'ttsLogSize', sfx: 'sfxLogSize', pings: 'pingsLogSize',
                staff: 'staffLogSize', mod: 'modLogSize', fish: 'fishLogSize',
                admin: 'adminLogSize',
            }[logType] || 'adminLogSize';
            sizeInput.value = getSetting(sizeKey) || 200;

            // Hide admin filter for non-admin logs
            const filterPanel = contentArea.querySelector('[data-ftl-admin-filter]');
            if (filterPanel) filterPanel.classList.toggle('hidden', logType !== 'admin');

            renderLog(logType, logContent, currentUsername$1);

            // Show admin filter UI for admin log
            if (logType === 'admin') {
                showAdminFilter(contentArea, logContent);
            }
        }

        logBtns.forEach(btn => {
            btn.addEventListener('click', () => activateLog(btn.getAttribute('data-ftl-log')));
        });

        // Log size change
        sizeInput.addEventListener('change', () => {
            const val = Math.max(1, Math.min(1000, parseInt(sizeInput.value) || 200));
            sizeInput.value = val;
            const sizeKey = {
                tts: 'ttsLogSize', sfx: 'sfxLogSize', pings: 'pingsLogSize',
                staff: 'staffLogSize', mod: 'modLogSize', fish: 'fishLogSize',
                admin: 'adminLogSize',
            }[activeLogType];
            if (sizeKey) {
                updateSetting(sizeKey, val);
                resizeLog(activeLogType, val);
            }
        });

        // Clear log
        clearBtn.addEventListener('click', () => {
            clearBtn.classList.add('hidden');
            clearConfirm.classList.remove('hidden');
        });
        clearNo.addEventListener('click', () => {
            clearConfirm.classList.add('hidden');
            clearBtn.classList.remove('hidden');
        });
        clearYes.addEventListener('click', () => {
            clearConfirm.classList.add('hidden');
            clearBtn.classList.remove('hidden');
            clearLog(activeLogType);
            renderLog(activeLogType, logContent, currentUsername$1);
        });

        // Default to admin, or use pending log type if navigating from ping button etc.
        activateLog(pendingLog || 'admin');
    }

    // ── Admin filter UI ─────────────────────────────────────────────────

    function showAdminFilter(contentArea, logContent) {
        let filterPanel = contentArea.querySelector('[data-ftl-admin-filter]');
        if (!filterPanel) {
            filterPanel = document.createElement('div');
            filterPanel.setAttribute('data-ftl-admin-filter', '');
            filterPanel.className = 'mb-2';
            filterPanel.innerHTML = `
            <div class="flex items-center gap-2 mb-1">
                <span class="text-xs opacity-60">Filter terms (hide matching toasts)</span>
            </div>
            <div class="flex gap-1 mb-1">
                <input data-ftl-filter-input type="text" placeholder="e.g. You found an item" class="flex-1 font-regular text-xs leading-none h-[24px] px-2 rounded-md bg-gradient-to-t border-1 text-light-text text-shadow-input focus-visible:outline-1 focus-visible:outline-tertiary from-dark-500 via-dark-500 to-dark-600 border-light/50 outline-1 outline-dark/25" />
                <button data-ftl-filter-add class="text-xs px-2 h-[24px] rounded-md bg-dark-400/75 border-1 border-light/25 cursor-pointer hover:brightness-125" type="button">Add</button>
            </div>
            <div data-ftl-filter-list class="flex flex-wrap gap-1 min-h-[20px]"></div>
        `;
            logContent.insertAdjacentElement('beforebegin', filterPanel);

            const filterInput = filterPanel.querySelector('[data-ftl-filter-input]');
            const filterAdd = filterPanel.querySelector('[data-ftl-filter-add]');
            const filterList = filterPanel.querySelector('[data-ftl-filter-list]');

            const addTerm = () => {
                const val = filterInput.value.trim();
                if (addFilterTerm(val)) {
                    filterInput.value = '';
                    renderFilterList(filterList);
                } else {
                    filterInput.value = '';
                }
            };

            filterAdd.addEventListener('click', addTerm);
            filterInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') addTerm();
            });

            renderFilterList(filterList);
        }
        filterPanel.classList.remove('hidden');
    }

    function renderFilterList(container) {
        container.innerHTML = '';
        const terms = getAdminFilter();
        if (terms.length === 0) {
            container.innerHTML = '<div class="text-xs opacity-40 italic">No filter terms yet</div>';
            return;
        }
        terms.forEach((term, i) => {
            const pill = document.createElement('div');
            pill.className = 'flex items-center gap-1 bg-dark-400/50 rounded px-2 py-0.5 text-xs';

            const label = document.createElement('span');
            label.className = 'opacity-75';
            label.textContent = term;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'opacity-40 hover:opacity-100 hover:text-red-400 cursor-pointer ml-1';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', () => {
                removeFilterTerm(i);
                renderFilterList(container);
            });

            pill.appendChild(label);
            pill.appendChild(removeBtn);
            container.appendChild(pill);
        });
    }

    // ── Tip link ────────────────────────────────────────────────────────

    function wireUpTipLink(contentArea) {
        contentArea.querySelector('#ftl-tip-link')?.addEventListener('click', () => {
            contentArea.remove();
            dispatchPageEvent('modalClose');
            setTimeout(() => {
                dispatchPageEvent('modalOpen', {
                    modal: 'tip',
                    data: JSON.stringify({
                        userId: '3bd89a72-5aa2-4ad8-b461-71516bd6b4d5',
                        displayName: 'BarryThePirate'
                    }),
                });
            }, 50);
        });
    }

    /**
     * zones.js — Hidden clickable zone detection
     *
     * Detects hidden clickable zones in the video player's SVG overlay,
     * makes them visible with a distinct hover colour, and notifies the
     * user via toast.
     *
     * The SVG overlay sits inside the video player container. Polygons
     * with `pointer-events-visible` but WITHOUT `cursor-pointer` are
     * hidden zones (easter eggs that give items when clicked).
     *
     * Detection strategy:
     * - Observe #live-stream-player for SVG changes (targeted, NOT body)
     * - When polygons appear, scan for hidden ones
     * - Unhide by adding cursor-pointer + our custom hover class
     * - Toast notification with count
     * - Re-scan when SVG changes (camera switch)
     *
     * The observer is on the player container, which is a stable element.
     * It disconnects if the player is removed, and reconnects when it
     * reappears.
     */


    const HIDDEN_ZONE_CLASS = 'ftl-ext-hidden-zone';
    let playerObserver$1 = null;
    let cssInjected = false;

    /**
     * Inject the CSS for hidden zone highlighting.
     * Uses inline <style> since Tailwind classes may not exist.
     */
    function injectCSS() {
        if (cssInjected) return;
        const style = document.createElement('style');
        style.textContent = `
        .${HIDDEN_ZONE_CLASS} {
            cursor: pointer !important;
        }
        .${HIDDEN_ZONE_CLASS}:hover {
            fill: #F8EC9426 !important;
        }
    `;
        document.head.appendChild(style);
        cssInjected = true;
    }

    /**
     * Scan an SVG element for hidden clickable zones and unhide them.
     * Returns the number of hidden zones found.
     */
    function scanAndUnhide(svg) {
        const polygons = svg.querySelectorAll('polygon.pointer-events-visible');
        let hiddenCount = 0;

        for (const polygon of polygons) {
            // Already processed by us
            if (polygon.classList.contains(HIDDEN_ZONE_CLASS)) continue;

            // Hidden zones have pointer-events-visible but lack cursor-pointer
            if (!polygon.classList.contains('cursor-pointer')) {
                polygon.classList.add(HIDDEN_ZONE_CLASS);
                hiddenCount++;
            }
        }

        return hiddenCount;
    }

    /**
     * Find the SVG overlay in the player and scan it.
     */
    function scanPlayer() {
        if (!getSetting('revealHiddenZones')) return;

        const player = document.getElementById('live-stream-player');
        if (!player) return;

        // The SVG overlay is a child of the player's grandparent (.fixed.bg-dark container)
        const container = player.parentElement?.parentElement;
        if (!container) return;

        const svg = container.querySelector('svg.absolute.z-1');
        if (!svg) return;

        const found = scanAndUnhide(svg);

        if (found > 0) {
            const label = found === 1 ? 'Hidden clickable zone detected!' : `${found} hidden clickable zones detected!`;
            console.log(label);
            notify(label, {
                description: 'FTL Extended revealed it for you',
                type: 'info',
                duration: 5000,
            });
        }
    }

    /**
     * Start observing the video player area for SVG changes.
     * Called once on startup. Watches the player's parent container
     * for child changes (SVG appearing, disappearing, or being replaced
     * when switching cameras).
     */
    function initZoneDetection() {
        if (!getSetting('revealHiddenZones')) return;

        injectCSS();

        // Initial scan in case the SVG already exists
        scanPlayer();

        // Watch for the player container to gain/lose SVG children
        // We observe the parent of #live-stream-player since the SVG
        // is a sibling of the player element
        function startObserving() {
            const player = document.getElementById('live-stream-player');
            if (!player) return false;

            const container = player.parentElement?.parentElement;
            if (!container) return false;

            // Don't double-observe
            if (playerObserver$1) playerObserver$1.disconnect();

            playerObserver$1 = new MutationObserver(() => {
                scanPlayer();
            });

            playerObserver$1.observe(container, { childList: true, subtree: true });
            return true;
        }

        // The player might not exist yet on first load
        if (!startObserving()) {
            let attempts = 0;
            const poll = setInterval(() => {
                attempts++;
                if (startObserving() || attempts > 40) {
                    clearInterval(poll);
                }
            }, 250);
        }
    }

    /**
     * theatre.js — Enhanced Theatre Mode
     *
     * Replaces the site's built-in theatre mode with a cleaner experience:
     * video fills the viewport with an optional collapsible chat panel.
     *
     * When the 'enhancedTheatreMode' setting is enabled:
     * - Intercepts the T keypress (stopImmediatePropagation prevents site handler)
     * - Intercepts clicks on the site's theatre mode button
     * - Intercepts clicks on the fullscreen button (uses page fullscreen instead)
     * - Uses our backdrop overlay approach instead of the site's layout
     *
     * When disabled, T and the button work as normal (site's theatre mode).
     *
     * Strategy:
     * - Insert a black backdrop div at z-index 50 to cover all site chrome
     * - Raise the video container and chat container to z-index 51
     * - Raise the chat container's parent (z-1 stacking context) to z-index 51
     * - Resize video to fill the viewport (minus chat width when open)
     * - Add a toggle button to show/hide chat
     * - ESC to exit
     * - Auto-exit if the video player is removed from the DOM
     */


    const BACKDROP_ID = 'ftl-ext-theatre-backdrop';
    const TOGGLE_BTN_ID = 'ftl-ext-theatre-chat-toggle';
    const STYLE_ID = 'ftl-ext-theatre-styles';
    const BODY_CLASS = 'ftl-theatre-mode';
    const CHAT_WIDTH = 368; // matches site's 2xl:w-[368px]

    let active = false;
    let chatVisible = true;
    let videoContainer = null;
    let chatContainer = null;
    let savedVideoStyles = {};
    let savedChatStyles = {};
    let savedChatParentZIndex = '';
    let playerObserver = null;

    /**
     * Find the video player's outermost container.
     * It's the .fixed.bg-dark element that contains #live-stream-player.
     */
    function findVideoContainer() {
        const player = document.getElementById('live-stream-player');
        if (!player) return null;
        let el = player.parentElement;
        while (el && el !== document.body) {
            if (el.classList.contains('fixed') && (el.classList.contains('bg-dark') || el.style.transform !== undefined)) {
                return el;
            }
            el = el.parentElement;
        }
        return player.parentElement?.parentElement || null;
    }

    /**
     * Find the chat container.
     * It's the .fixed element that contains #chat-input.
     */
    function findChatContainer() {
        const chatInput = document.getElementById('chat-input');
        if (!chatInput) return null;
        let el = chatInput.parentElement;
        while (el && el !== document.body) {
            if (el.classList.contains('fixed') || (el.style.position === 'fixed')) {
                return el;
            }
            el = el.parentElement;
        }
        return null;
    }

    /**
     * Save an element's current inline styles so we can restore them later.
     */
    function saveStyles(el) {
        return {
            cssText: el.style.cssText,
            className: el.className,
        };
    }

    /**
     * Restore an element's saved inline styles.
     */
    function restoreStyles(el, saved) {
        el.style.cssText = saved.cssText;
        el.className = saved.className;
    }

    /**
     * Inject the theatre mode stylesheet.
     */
    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
        /* Backdrop covers everything */
        #${BACKDROP_ID} {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: #000;
            z-index: 50;
        }

        /* Chat toggle button */
        #${TOGGLE_BTN_ID} {
            position: fixed;
            bottom: 60px;
            right: 0;
            z-index: 52;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-right: none;
            border-radius: 8px 0 0 8px;
            color: rgba(255, 255, 255, 0.7);
            cursor: pointer;
            padding: 12px 6px;
            font-size: 14px;
            line-height: 1;
            backdrop-filter: blur(4px);
            transition: background 0.15s, color 0.15s, right 0.3s ease;
        }
        #${TOGGLE_BTN_ID}:hover {
            background: rgba(255, 255, 255, 0.2);
            color: #fff;
        }

        /* When chat is open, nudge the button left */
        body.${BODY_CLASS}.ftl-theatre-chat-open #${TOGGLE_BTN_ID} {
            right: ${CHAT_WIDTH}px;
        }

        /* Ensure site modals appear above the backdrop */
        body.${BODY_CLASS} #modal {
            z-index: 52 !important;
        }

        /* Ensure DM/messenger windows appear above the backdrop */
        body.${BODY_CLASS} .fixed.z-25 {
            z-index: 52 !important;
        }

        /* Ensure profile popups appear above the backdrop */
        body.${BODY_CLASS} .fixed[draggable="false"] {
            z-index: 52 !important;
        }
        
        /* Ensure emoji/medal picker appears above the backdrop */
        body.${BODY_CLASS} [role="dialog"][aria-orientation] {
            z-index: 52 !important;
        }

        /* Ensure floating-ui dropdowns (TTS/SFX voice/room selects) appear above the backdrop */
        body.${BODY_CLASS} [data-floating-ui-portal] {
            position: relative;
            z-index: 53 !important;
        }

        /* Theatre mode transitions */
        body.${BODY_CLASS} .ftl-theatre-video {
            transition: width 0.3s ease, left 0.3s ease;
        }
        body.${BODY_CLASS} .ftl-theatre-chat {
            transition: transform 0.3s ease;
        }
    `;
        document.head.appendChild(style);
    }

    /**
     * Create the backdrop div.
     */
    function createBackdrop() {
        let backdrop = document.getElementById(BACKDROP_ID);
        if (!backdrop) {
            backdrop = document.createElement('div');
            backdrop.id = BACKDROP_ID;
            document.body.appendChild(backdrop);
        }
        return backdrop;
    }

    /**
     * Create the chat toggle button.
     */
    function createToggleButton() {
        let btn = document.getElementById(TOGGLE_BTN_ID);
        if (!btn) {
            btn = document.createElement('button');
            btn.id = TOGGLE_BTN_ID;
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 512 512" fill="currentColor"><path d="M408 48H104a72.08 72.08 0 0 0-72 72v192a72.08 72.08 0 0 0 72 72h24v64a16 16 0 0 0 26.25 12.29L245.74 384H408a72.08 72.08 0 0 0 72-72V120a72.08 72.08 0 0 0-72-72Z"/></svg>`;
            btn.title = 'Toggle chat';
            btn.addEventListener('click', toggleChat);
            document.body.appendChild(btn);
        }
        return btn;
    }

    /**
     * Watch for the video player being removed from the DOM.
     * If it disappears (e.g. navigating to a profile), exit theatre mode.
     *
     * React replaces the tree at a high level, so we observe document.body
     * with subtree. This observer only exists during theatre mode and
     * disconnects immediately when the player vanishes or theatre exits.
     */
    function watchPlayerRemoval() {
        // Observe body's direct children only (no subtree) to detect when
        // React swaps out the video container during navigation.
        if (!videoContainer) return;

        playerObserver = new MutationObserver(() => {
            if (!videoContainer.isConnected) {
                exitTheatre();
            }
        });

        playerObserver.observe(document.body, { childList: true });
    }

    /**
     * Apply theatre layout to video container.
     */
    function styleVideoForTheatre() {
        if (!videoContainer) return;
        videoContainer.classList.add('ftl-theatre-video');
        videoContainer.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: ${chatVisible ? `calc(100% - ${CHAT_WIDTH}px)` : '100%'} !important;
        height: 100% !important;
        z-index: 51 !important;
        border-radius: 0 !important;
        margin: 0 !important;
        transform: none !important;
    `;
    }

    /**
     * Apply theatre layout to chat container.
     * Also raises the parent wrapper which has z-1 creating a stacking
     * context that would otherwise trap the chat below our backdrop.
     */
    function styleChatForTheatre() {
        if (!chatContainer) return;

        // The chat container's parent has class="relative z-1" which creates
        // a stacking context — everything inside is trapped at z-index 1.
        // We need to lift that parent above the backdrop too.
        if (chatContainer.parentElement && chatContainer.parentElement !== document.body) {
            chatContainer.parentElement.style.zIndex = '51';
        }

        chatContainer.classList.add('ftl-theatre-chat');
        chatContainer.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        left: auto !important;
        width: ${CHAT_WIDTH}px !important;
        height: 100% !important;
        z-index: 51 !important;
        border-radius: 0 !important;
        margin: 0 !important;
        transform: ${chatVisible ? 'translateX(0)' : `translateX(${CHAT_WIDTH}px)`} !important;
    `;
    }

    /**
     * Update layout when chat visibility changes.
     */
    function updateLayout() {
        styleVideoForTheatre();
        styleChatForTheatre();

        if (chatVisible) {
            document.body.classList.add('ftl-theatre-chat-open');
        } else {
            document.body.classList.remove('ftl-theatre-chat-open');
        }
    }

    /**
     * Toggle chat panel visibility.
     */
    function toggleChat() {
        chatVisible = !chatVisible;
        updateLayout();
    }

    /**
     * Enter theatre mode.
     */
    function enterTheatre() {
        if (active) return;

        // If already in browser fullscreen, exit it first to prevent
        // the site's fullscreen theatre mode from interfering, then
        // re-enter fullscreen with our clean layout
        if (document.fullscreenElement) {
            document.exitFullscreen().then(() => {
                setTimeout(() => {
                    enterTheatre();
                    setTimeout(() => {
                        document.documentElement.requestFullscreen();
                    }, 100);
                }, 100);
            });
            return;
        }

        videoContainer = findVideoContainer();
        chatContainer = findChatContainer();

        if (!videoContainer) {
            notify('Theatre mode unavailable', {
                description: 'No video player found',
                type: 'error',
                duration: 3000,
            });
            return;
        }

        // Save original styles
        savedVideoStyles = saveStyles(videoContainer);
        if (chatContainer) {
            savedChatStyles = saveStyles(chatContainer);
            if (chatContainer.parentElement && chatContainer.parentElement !== document.body) {
                savedChatParentZIndex = chatContainer.parentElement.style.zIndex;
            }
        }

        injectStyles();
        createBackdrop();
        createToggleButton();

        chatVisible = true;
        document.body.classList.add(BODY_CLASS);
        document.body.classList.add('ftl-theatre-chat-open');

        updateLayout();
        watchPlayerRemoval();

        active = true;
    }

    /**
     * Exit theatre mode.
     */
    function exitTheatre() {
        if (!active) return;

        // Disconnect player removal watcher
        if (playerObserver) {
            playerObserver.disconnect();
            playerObserver = null;
        }

        // Exit browser fullscreen if active
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }

        // Remove backdrop
        const backdrop = document.getElementById(BACKDROP_ID);
        if (backdrop) backdrop.remove();

        // Remove toggle button
        const btn = document.getElementById(TOGGLE_BTN_ID);
        if (btn) btn.remove();

        // Restore original styles
        if (videoContainer) {
            restoreStyles(videoContainer, savedVideoStyles);
            videoContainer.classList.remove('ftl-theatre-video');
        }
        if (chatContainer) {
            restoreStyles(chatContainer, savedChatStyles);
            chatContainer.classList.remove('ftl-theatre-chat');
            if (chatContainer.parentElement && chatContainer.parentElement !== document.body) {
                chatContainer.parentElement.style.zIndex = savedChatParentZIndex;
            }
        }

        document.body.classList.remove(BODY_CLASS);
        document.body.classList.remove('ftl-theatre-chat-open');

        active = false;
        videoContainer = null;
        chatContainer = null;
        savedChatParentZIndex = '';
    }

    /**
     * Toggle theatre mode on/off.
     * Checks the enhancedTheatreMode setting — if disabled, does nothing
     * (lets the site's native theatre mode handle it).
     */
    function toggleTheatre() {
        if (!getSetting('enhancedTheatreMode')) return;

        if (active) {
            exitTheatre();
        } else {
            enterTheatre();
        }
    }

    /**
     * Check if theatre mode is currently active.
     */
    function isTheatreActive() {
        return active;
    }

    /**
     * Intercept clicks on the site's theatre mode button, close button,
     * and fullscreen button. Called once on startup.
     */
    function initTheatreButtonIntercept() {
        function interceptHandler(e) {
            const btn = e.target.closest('button');
            if (!btn) return;

            // Check if it's the theatre button
            if (getSetting('enhancedTheatreMode')) {
                const svg = btn.querySelector('svg');
                if (svg) {
                    const path = svg.querySelector('path');
                    if (path && path.getAttribute('d')?.includes('M18 18v94.275')) {
                        e.stopPropagation();
                        e.preventDefault();
                        toggleTheatre();
                        return;
                    }
                }
            }

            // Check if it's the close/back button (X icon) while theatre is active
            // Only match the X on the video player, not on modals, DMs, or other popups
            if (active && !btn.closest('#modal') && !btn.closest('.fixed[draggable="false"]')) {
                const paths = btn.querySelectorAll('svg path');
                for (const p of paths) {
                    if (p.getAttribute('d')?.includes('M400 145.49')) {
                        exitTheatre();
                        return;
                    }
                }
            }

            // Check if it's the fullscreen button
            if (getSetting('enhancedTheatreMode')) {
                const paths = btn.querySelectorAll('svg path');
                for (const p of paths) {
                    if (p.getAttribute('d')?.includes('M432 320v112H320')) {
                        e.stopPropagation();
                        e.preventDefault();
                        if (document.fullscreenElement) {
                            document.exitFullscreen();
                            if (active) exitTheatre();
                        } else {
                            if (!active) enterTheatre();
                            document.documentElement.requestFullscreen();
                        }
                        return;
                    }
                }
            }
        }

        document.addEventListener('click', interceptHandler, true);
    }

    /**
     * inventory.js — Inventory and item grid search
     *
     * Injects search inputs into:
     * 1. The inventory popup (floating-ui-portal, NOT a modal)
     * 2. The crafting modal's "Select Item" overlay (inside #modal)
     *
     * Both grids use img[alt] for item names — the same filtering logic
     * works for both. Empty slots are hidden while searching.
     *
     * Detection: uses a click listener + short poll. NO persistent body observers.
     */


    let inventoryInjected = false;

    // ── Shared: create a search input and wire up filtering ─────────────

    function createSearchInput(placeholder, items, container, insertAfter) {
        const wrapper = document.createElement('div');
        wrapper.setAttribute('data-ftl-sdk', 'item-search');
        wrapper.className = 'px-1 pb-1';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder;
        input.className = 'font-regular text-md leading-none w-full h-[32px] p-1 mt-2 shadow-md shadow-dark/15 rounded-md bg-gradient-to-t border-1 text-light-text text-shadow-input focus:shadow-lg focus-visible:outline-1 focus-visible:outline-tertiary from-dark-500 via-dark-500 to-dark-600 border-light/50 outline-1 outline-dark/25 mb-1';

        // Prevent keyboard shortcuts from firing while typing
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });

        wrapper.appendChild(input);
        insertAfter.insertAdjacentElement('afterend', wrapper);

        input.addEventListener('input', () => {
            const query = input.value.trim().toLowerCase();

            for (const item of items) {
                const img = item.querySelector('img');
                if (!img) {
                    // Empty slot — hide when searching, show when cleared
                    item.style.display = query ? 'none' : '';
                    continue;
                }

                const name = (img.alt || '').toLowerCase();
                const match = !query || name.includes(query);
                item.style.display = match ? '' : 'none';
            }

            // Pack visible items to the top of the grid
            container.style.alignContent = query ? 'start' : '';
        });

        // Auto-focus
        setTimeout(() => input.focus(), 50);

        return wrapper;
    }

    // ── Inventory popup (floating-ui-portal) ────────────────────────────

    function tryInjectInventorySearch() {
        if (inventoryInjected) return;
        if (!getSetting('enableInventorySearch')) return;

        const portals = document.querySelectorAll('[data-floating-ui-portal]');
        for (const portal of portals) {
            const dialog = portal.querySelector('[role="dialog"]');
            if (!dialog) continue;

            const header = dialog.querySelector('.flex.h-\\[32px\\].items-center');
            if (!header) continue;
            const title = header.querySelector('.font-bold');
            if (!title || title.textContent.trim() !== 'Inventory') continue;

            const grid = dialog.querySelector('[role="listbox"]');
            if (!grid) continue;

            if (dialog.querySelector('[data-ftl-sdk="item-search"]')) {
                inventoryInjected = true;
                return;
            }

            const items = grid.querySelectorAll('[role="option"]');
            createSearchInput('Search inventory...', items, grid, header);
            inventoryInjected = true;

            // Clean up when inventory closes
            const closeObserver = new MutationObserver(() => {
                if (!portal.contains(dialog)) {
                    closeObserver.disconnect();
                    inventoryInjected = false;
                }
            });
            closeObserver.observe(portal, { childList: true });
            return;
        }
    }

    // ── Crafting item select (inside #modal) ────────────────────────────

    function tryInjectCraftingItemSearch() {
        if (!getSetting('enableInventorySearch')) return;

        const modal = document.getElementById('modal');
        if (!modal) return;

        // Find "Select Item" title — it's a .font-bold inside the item select overlay
        const titles = modal.querySelectorAll('.font-bold');
        let title = null;
        for (const t of titles) {
            if (t.textContent.trim() === 'Select Item') {
                title = t;
                break;
            }
        }
        if (!title) return;

        // The overlay is the parent container with the grid
        const overlay = title.closest('.absolute');
        if (!overlay) return;

        // Already injected
        if (overlay.querySelector('[data-ftl-sdk="item-search"]')) return;

        const grid = overlay.querySelector('.grid.grid-cols-5');
        if (!grid) return;

        // Get ALL direct children of the grid — both item buttons and empty placeholder divs
        const items = grid.children;
        createSearchInput('Search items...', items, grid, title);
    }

    // ── Trade modal item search (inside #modal) ─────────────────────────

    function initTradeSearch() {
        if (!getSetting('enableInventorySearch')) return;

        // Poll for #modal to exist (React renders it after the modalOpen event)
        let attempts = 0;
        const poll = setInterval(() => {
            attempts++;
            const modal = document.getElementById('modal');
            if (modal) {
                clearInterval(poll);
                injectTradeSearch(modal);
            } else if (attempts > 20) {
                clearInterval(poll);
            }
        }, 50);

        document.addEventListener('modalClose', () => clearInterval(poll), { once: true });
    }

    function injectTradeSearch(modal) {
        // Watch for the item grid to appear inside the trade modal
        const observer = new MutationObserver(() => {
            const grid = modal.querySelector('.grid.grid-cols-5');
            if (!grid) return;
            if (modal.querySelector('[data-ftl-sdk="item-search"]')) {
                observer.disconnect();
                return;
            }

            const gridParent = grid.parentElement;
            if (!gridParent) return;

            createSearchInput('Search items...', grid.children, grid, gridParent.previousElementSibling || gridParent);
            observer.disconnect();
        });

        observer.observe(modal, { childList: true, subtree: true });

        // Check immediately in case grid already exists
        const grid = modal.querySelector('.grid.grid-cols-5');
        if (grid && !modal.querySelector('[data-ftl-sdk="item-search"]')) {
            const gridParent = grid.parentElement;
            if (gridParent) {
                createSearchInput('Search items...', grid.children, grid, gridParent.previousElementSibling || gridParent);
                observer.disconnect();
            }
        }

        document.addEventListener('modalClose', () => observer.disconnect(), { once: true });
    }

    /**
     * index.js — FTL Extended entry point (current site)
     *
     * This file is the orchestrator. It wires up the SDK, registers
     * callbacks, and delegates to feature modules. It should stay slim.
     *
     * DATA CAPTURE STRATEGY:
     * - Chat messages, TTS, SFX → Socket.IO (reliable, never misses messages)
     * - Toast notifications → DOM observer on Sonner container (no socket event for all toast types)
     * - Modal detection → CustomEvent listener (modalOpen/modalClose)
     * - Dropdown injection → click listener
     *
     * PERFORMANCE RULES:
     * - ZERO persistent MutationObservers on document.body
     * - Only one targeted DOM observer: Sonner toast container
     * - Socket.IO is an independent connection, no monkey-patching
     */


    const DEBUG = false;
    const log = (...args) => DEBUG;

    // ── Pre-ready setup (must not miss early events) ────────────────────

    loadSettings();

    // Detect username via SDK polling (no body observer)
    let currentUsername = null;
    onUserDetected((username) => {
        currentUsername = username;
        setCurrentUsername(username);
    });

    // Listen for modal events via CustomEvent (no body observer needed)
    document.addEventListener('modalOpen', (e) => {
        // Firefox content scripts can't access e.detail from page-context CustomEvents
        // Clone it to avoid "Permission denied to access property" errors
        let detail;
        try {
            detail = e.detail ? JSON.parse(JSON.stringify(e.detail)) : {};
        } catch {
            detail = {};
        }

        // Log modal info if debug is on
        log('[MODAL]', detail?.modal, detail);

        // Clean up any injected extension content when any modal opens
        document.querySelector('[data-ftl-sdk="settings"]')?.remove();

        const modalName = detail?.modal;
        setActiveModal(modalName || null);

        // Auto-close season pass popup
        if (modalName === 'seasonPass' && getSetting('autoCloseSeasonPassPopup')) {
            setTimeout(() => document.dispatchEvent(new CustomEvent('modalClose')), 0);
        }

        // Inject crafting hints when craft modal opens
        if (modalName === 'craftItem') {
            initCraftingHints();
        }

        // Inject use-item hints when use modal opens
        if (modalName === 'useItem') {
            initUseItemHints();
        }

        // Inject item search when trade modal opens
        if (modalName === 'tradeItem') {
            initTradeSearch();
        }
    });

    document.addEventListener('modalClose', () => {
        setActiveModal(null);
    });

    // Inject flash animation CSS
    const flashStyle = document.createElement('style');
    flashStyle.textContent = `
    @keyframes ftl-flash {
        0%   { background-color: rgba(255, 255, 255, 0.15); }
        100% { background-color: transparent; }
    }
    .ftl-flash {
        animation: ftl-flash 1.5s ease-out forwards;
    }
`;
    document.head.appendChild(flashStyle);

    // ── Site ready ──────────────────────────────────────────────────────

    whenReady(async () => {

        // Load cached data
        loadLogs();
        loadRecipesFromCache();
        fetchRecipes();
        fetchRoomNames();

        // ── Socket.IO connection (primary data source) ──────────────────
        // Connects to wss://ws.fishtank.live with msgpack encoding.
        // Uses token: null for anonymous access (global chat).
        // This is a separate connection from the site's own socket.

        try {
            const connectTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('connection timeout')), 10000)
            );
            await Promise.race([
                connect(lookup, msgpackParser, { token: null }),
                connectTimeout,
            ]);
            log('Socket connected');
        } catch (err) {
            console.warn('[FTL Extended] Socket connection failed:', err.message);
            console.warn('[FTL Extended] Chat/TTS/SFX logging will not work this session');
        }

        // ── Season Pass room auto-detection ─────────────────────────────
        // Wait for the user's auth cookie to appear, extract their UUID,
        // fetch their profile to check Season Pass status, then subscribe
        // to additional rooms if they have access and haven't turned it off.

        onUserIdDetected((userId) => {

            fetch(`https://api.fishtank.live/v1/profile/${userId}`)
                .then(r => r.json())
                .then(async (data) => {
                    const profile = data?.profile;
                    if (!profile) return;

                    // Update pass status for settings UI
                    setUserPasses({
                        seasonPass: !!profile.seasonPass,
                        seasonPassXL: !!profile.seasonPassXL,
                    });

                    // Subscribe to extra rooms, then re-emit Global on the
                    // primary socket so the server remembers Global as the
                    // last room — this ensures the site defaults to Global
                    // on the next page refresh.
                    let subscribed = false;

                    if (profile.seasonPass && getSetting('monitorSeasonPass')) {
                        const ok = await subscribe('Season Pass');
                        if (ok) { subscribed = true; }
                    }
                    if (profile.seasonPassXL && getSetting('monitorSeasonPassXL')) {
                        const ok = await subscribe('Season Pass XL');
                        if (ok) { subscribed = true; }
                    }

                    if (subscribed) {
                        const raw = getSocket();
                        if (raw) raw.emit('chat:room', 'Global');
                    }
                })
                .catch(err => {
                    log('Profile fetch failed:', err.message);
                });
        });

        // ── Chat messages via SDK (normalised + structured) ────────────────

        onMessage((msg) => {
            log('[CHAT]', msg.username, msg.message);

            // Pings — chat messages that mention the current user
            if (currentUsername && msg.mentions.length > 0) {
                const lower = currentUsername.toLowerCase();
                if (msg.mentions.some(m => m.displayName.toLowerCase() === lower)) {
                    logPing(msg);
                }
            }

            // Staff / Mod / Fish messages (logged to dedicated role logs)
            // Epic and Grand Marshal are visual styling only, not separate log categories
            if (msg.role === 'staff' || msg.role === 'mod' || msg.role === 'fish') {
                logRoleMessage(msg);
            }
        });

        // ── TTS via SDK (normalised + deduplicated) ─────────────────────

        onTTS((msg) => {
            log('[TTS]', msg.username, msg.message, msg.voice, msg.room);
            logTts(msg);
        });

        // ── SFX via SDK (normalised + deduplicated) ─────────────────────

        onSFX((msg) => {
            log('[SFX]', msg.username, msg.message, msg.room);
            logSfx(msg);
        });

        // ── Socket health monitor ───────────────────────────────────────
        // Global chat is very active — if we haven't received ANY event
        // in 60 seconds, something is wrong. Force a reconnect.

        let lastSocketEvent = Date.now();

        // Update the timestamp on any socket event
        on$1('chat:message', () => { lastSocketEvent = Date.now(); });
        on$1('tts:insert',   () => { lastSocketEvent = Date.now(); });
        on$1('tts:update',   () => { lastSocketEvent = Date.now(); });
        on$1('sfx:insert',   () => { lastSocketEvent = Date.now(); });
        on$1('sfx:update',   () => { lastSocketEvent = Date.now(); });
        on$1('chat:presence', () => { lastSocketEvent = Date.now(); });
        on$1('presence',      () => { lastSocketEvent = Date.now(); });

        setInterval(() => {
            const silenceMs = Date.now() - lastSocketEvent;
            if (silenceMs > 60000 && isConnected()) {
                console.warn(`[FTL Extended] No socket events for ${Math.round(silenceMs / 1000)}s — forcing reconnect`);
                forceReconnect();
                lastSocketEvent = Date.now(); // Reset so we don't spam reconnects
            }
        }, 15000);

        // ── Toast observer (DOM-based, for admin notifications) ─────────
        // Toasts include item drops, crafting alerts, season pass gifts,
        // and admin announcements. Not all of these have socket events,
        // so we keep the DOM observer for toasts.

        await waitAndObserve();

        onToast((toast) => {
            logAdminToast(toast);
        });

        // ── Keyboard shortcuts ──────────────────────────────────────────

        // E always opens FTL Extended settings
        register('ftl-settings', { key: 'e' }, openSettingsModal);

        // Togglable shortcuts
        const shortcutIf = (fn) => () => { if (getSetting('enableKeyboardShortcuts')) fn(); };

        register('open-settings',     { key: 'q' }, shortcutIf(() => openModal('settings')));
        register('open-edit-profile', { key: 'p' }, shortcutIf(() => openModal('editProfile')));
        register('open-help',         { key: 'h' }, shortcutIf(() => openModal('help')));
        register('open-season-pass',  { key: 'x' }, shortcutIf(() => openModal('seasonPass')));
        register('theatre-mode',      { key: 't' }, (e) => {
            if (getSetting('enhancedTheatreMode')) {
                // Block the site's own theatre mode handler
                e.stopImmediatePropagation();
                toggleTheatre();
            }
            // When setting is off, do nothing — let the event reach the site's handler
        });
        register('theatre-fullscreen', { key: 'f', preventDefault: false }, (e) => {
            if (getSetting('enhancedTheatreMode')) {
                e.stopImmediatePropagation();
                if (document.fullscreenElement) {
                    // Already fullscreen — just exit fullscreen
                    document.exitFullscreen();
                    // If theatre mode is active, exit that too
                    if (isTheatreActive()) exitTheatre();
                } else {
                    // Enter our theatre mode first, then fullscreen
                    if (!isTheatreActive()) enterTheatre();
                    document.documentElement.requestFullscreen();
                }
            }
        });
        register('theatre-exit',      { key: 'escape', preventDefault: false }, () => {
            if (isTheatreActive()) exitTheatre();
        });
        register('open-craft',        { key: 'c' }, shortcutIf(() => openModal('craftItem')));
        register('open-item-market',  { key: 'm' }, shortcutIf(() => openModal('itemMarket')));
        register('open-stox',         { key: 's' }, shortcutIf(() => {
            if (document.getElementById('modal')) {
                document.dispatchEvent(new CustomEvent('modalClose'));
                setTimeout(() => {
                    const stoxBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Stox');
                    if (stoxBtn) stoxBtn.click();
                }, 50);
            } else {
                const stoxBtn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Stox');
                if (stoxBtn) stoxBtn.click();
            }
        }));

        // ── Dropdown button injection (click listener, NOT body observer) ─

        document.addEventListener('click', () => {
            setTimeout(tryInjectDropdownButton, 100);
            setTimeout(tryInjectInventorySearch, 100);
            setTimeout(tryInjectCraftingItemSearch, 100);
        });

        // ── Hidden clickable zone detection ────────────────────────────────

        initZoneDetection();

        // ── Ping button in chat header ──────────────────────────────────

        tryInjectPingButton();
        setOnPingCountChange(updatePingBadge);

        // ── Theatre mode button intercept ───────────────────────────────

        initTheatreButtonIntercept();

        // ── Video stutter fix ───────────────────────────────────────────
        // The site's HLS player falls behind the live edge and attempts a
        // gradual 1.1x catch-up that causes frame drops and freezing.
        // This fix monitors the video element and snaps to the live edge
        // when playback falls more than 3 seconds behind. It also resets
        // the playback rate to 1x to prevent the decoder from struggling.

        if (getSetting('videoStutterFix')) {
            setInterval(() => {
                const video = document.querySelector('video');
                if (!video || !video.buffered.length) return;
                if (video.playbackRate !== 1) video.playbackRate = 1;
                const edge = video.buffered.end(video.buffered.length - 1);
                const behind = edge - video.currentTime;
                if (behind > 3) {
                    video.currentTime = edge - 0.5;
                    log('Video stutter fix: snapped to live edge, was', behind.toFixed(1) + 's behind');
                }
            }, 3000);
        }

        // ── Chat filter (page-level script injection) ────────────────────
        // Injects a script into the page realm to access the React/Zustand
        // chat store directly. This bypasses the content script cross-realm
        // limitation.

        let detectedUserId = null;

        // Track user ID and keep sending it until the page script confirms receipt
        onUserIdDetected((userId) => {
            detectedUserId = userId;
        });

        // Retry sending user ID and enabled state every second until confirmed
        const userIdInterval = setInterval(() => {
            if (detectedUserId) {
                window.postMessage({ type: 'ftl-chat-filter-userid', userId: detectedUserId }, '*');
            }
            window.postMessage({ type: 'ftl-chat-filter-enabled', enabled: getSetting('smartAntiSpam') }, '*');
        }, 1000);

        // Stop retrying user ID once the page script confirms
        window.addEventListener('message', (e) => {
            if (e.data?.type === 'ftl-chat-filter-userid-ack') {
                clearInterval(userIdInterval);
                // Send enabled state one final time after ack
                window.postMessage({ type: 'ftl-chat-filter-enabled', enabled: getSetting('smartAntiSpam') }, '*');
            }
        });

        const chatFilterScript = document.createElement('script');
        chatFilterScript.src = chrome.runtime.getURL('current/chat-filter.js');
        document.documentElement.appendChild(chatFilterScript);
        chatFilterScript.onload = () => chatFilterScript.remove();

        // ── Startup toast ───────────────────────────────────────────────

        notify('FTL Extended loaded!', {
            description: 'v2.1.2',
            type: 'success',
            duration: 3000,
        });
    });

})();
