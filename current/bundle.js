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
     * core/debug.js — SDK Debug Logging
     *
     * Gates routine lifecycle logs (connects, disconnects, subscribes)
     * behind an opt-in debug flag. Errors and warnings are NOT gated —
     * they remain visible at all times.
     *
     * Usage (consumer):
     *
     *   import { debug } from 'ftl-ext-sdk';
     *   debug.enable();   // turn on lifecycle logs
     *   debug.disable();  // turn them off (default)
     *
     * Usage (inside the SDK):
     *
     *   import { debugLog } from './debug.js';
     *   debugLog('Socket connected');
     *
     * debugLog is a no-op when debug is disabled. Equivalent to
     * console.log with an '[ftl-ext-sdk]' prefix when enabled.
     */


    /**
     * Internal logging helper. No-op when debug is disabled.
     *
     * @param {...any} args
     */
    function debugLog(...args) {
    }

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

            debugLog(
                'Socket connected',
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
            debugLog('Socket disconnected:', reason);
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
        // Auto-reconnect is disabled for room sockets. The consumer
        // (chat/rooms.js or an extension) is responsible for detecting
        // disconnect and manually re-subscribing when appropriate — this
        // lets the consumer control ordering so that room socket
        // reconnects don't clobber the user's "current room" on the
        // backend by firing authenticated reconnects at unpredictable times.
        reconnection: false,
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
     * core/transport.js — Cross-Origin Transport Layer
     *
     * The SDK needs to fetch cross-origin resources (e.g. audio files
     * from cdn.fishtank.live) in contexts where the page's CORS policy
     * would block a normal fetch(). Different host environments solve
     * this differently:
     *
     *   - Browser extensions use a background service worker that runs
     *     with host_permissions and can fetch any allowed origin.
     *   - Userscripts (Tampermonkey/Greasemonkey) use GM_xmlhttpRequest,
     *     which bypasses CORS entirely.
     *   - Pages that happen to use the SDK can use normal fetch() if
     *     the target sends appropriate CORS headers.
     *
     * Rather than baking any of these into the SDK, this module lets
     * the consumer register a fetch function of their choosing. Any
     * SDK feature that needs cross-origin access (such as ui.download)
     * calls `transport.fetch(url)` and doesn't care how it's implemented.
     *
     * Usage — Extension (background service worker):
     *
     *   import { transport } from 'ftl-ext-sdk';
     *
     *   transport.register(async (url) => {
     *     const response = await chrome.runtime.sendMessage({
     *       type: 'ftl-sdk-fetch',
     *       url,
     *     });
     *     if (!response?.ok) throw new Error(response?.error || 'Fetch failed');
     *     return new Uint8Array(response.data);
     *   });
     *
     * Usage — Userscript (GM_xmlhttpRequest):
     *
     *   transport.register((url) => new Promise((resolve, reject) => {
     *     GM_xmlhttpRequest({
     *       method: 'GET',
     *       url,
     *       responseType: 'arraybuffer',
     *       onload: (res) => resolve(new Uint8Array(res.response)),
     *       onerror: reject,
     *     });
     *   }));
     *
     * Usage — Plain page (target supports CORS):
     *
     *   transport.register(async (url) => {
     *     const res = await fetch(url);
     *     if (!res.ok) throw new Error(`HTTP ${res.status}`);
     *     return new Uint8Array(await res.arrayBuffer());
     *   });
     */

    let _fetchFn = null;

    /**
     * Register a cross-origin fetch function.
     *
     * The function receives a URL string and must return a Promise
     * resolving to a Uint8Array of the raw bytes. It should throw or
     * reject on failure.
     *
     * Calling register() a second time replaces the previous function.
     *
     * @param {Function} fetchFn - async (url) => Uint8Array
     */
    function register$1(fetchFn) {
        if (typeof fetchFn !== 'function') {
            throw new Error('[ftl-ext-sdk] transport.register requires a function');
        }
        _fetchFn = fetchFn;
    }

    /**
     * Fetch bytes from a URL using the registered transport.
     *
     * Throws if no transport has been registered, or if the transport
     * throws/rejects.
     *
     * @param {string} url - Absolute URL to fetch
     * @returns {Promise<Uint8Array>} Raw bytes
     */
    async function fetchBytes(url) {
        if (!_fetchFn) {
            throw new Error('[ftl-ext-sdk] No transport registered. Call transport.register(fn) first.');
        }
        const result = await _fetchFn(url);
        if (!(result instanceof Uint8Array)) {
            throw new Error('[ftl-ext-sdk] Transport function must return a Uint8Array');
        }
        return result;
    }

    /**
     * Check whether a transport has been registered.
     *
     * @returns {boolean}
     */
    function isRegistered() {
        return _fetchFn !== null;
    }

    /**
     * archives/index.js — Season Archive API
     *
     * Wraps the fishtank.live archive endpoints that power the /archives
     * page: room/day/video listings and signed watch URLs, plus pure
     * helpers for parsing archive filenames and resolving what's "on air"
     * at a given moment in the season timeline.
     *
     * The archive is stored as ~15-minute mp4 chunks per room per day.
     * Filenames encode their own schedule (e.g. "s03_bar_24-10-27_17-39-31.mp4"
     * starts at 17:39:31 show time on 2024-10-27). There is no duration
     * field — a chunk is bounded by the next chunk's startsAt, and its
     * exact playable length comes from the video element's metadata.
     * Gaps between chunks are genuine downtime ("No Signal").
     *
     * TIMESTAMPS: archive filenames/listings are stamped in UTC — verified
     * empirically (2026-08-18) by matching sunrise/sunset visible in the
     * footage against Rhode Island sun times; e.g. darkness falls at stamp
     * 21:2x on 2024-11-15, which is 16:2x EST — the real local sunset.
     * (The site's own re-run clock displays stamp time as if it were
     * Eastern, which is why its clock reads ~4-5h ahead of the visible
     * time of day.) parseShowTime() parses stamps as the UTC they are;
     * the "house" helpers convert to true America/New_York local time,
     * DST-aware — season 3 spans the Nov 2024 clock change.
     *
     * AUTH: watching archives requires being logged in to fishtank.live
     * with a season pass (the site's FREE_ARCHIVE_SEASONS marks s01 as
     * free). Requests send cookies; on failure everything here fails
     * silently (null / empty array).
     *
     * Watch URLs are signed per-file (Bunny CDN token + expiry, hours-scale
     * TTL) — never cache them long-term; re-request on playback error.
     *
     * Usage:
     *   import { archives } from 'ftl-ext-sdk';
     *
     *   const rooms  = await archives.getRooms('s03');            // ['bar', ...]
     *   const days   = await archives.getDays('s03', 'bar');      // ['2024-10-27', ...]
     *   const videos = await archives.getVideos('s03', 'bar', '2024-10-27');
     *
     *   const t = archives.parseShowTime('2024-10-27T18:00:00');
     *   const chunk = archives.findChunkAt(videos, t);
     *   if (chunk) {
     *     const url = await archives.getWatchUrl('s03', 'bar', '2024-10-27', chunk.video.fileName);
     *     // play url, seek to chunk.offsetSeconds
     *   }
     */


    const API_BASE = 'https://api.fishtank.live/v1';

    // Archive stamps are UTC (see module header). House time is the show
    // location's real local time.
    const HOUSE_TZ = 'America/New_York';

    // ── Listing cache ───────────────────────────────────────────────────
    // Listings are immutable historical data, so promises are memoized
    // in-memory. Failed fetches are evicted so they can be retried.

    const listingCache = new Map();

    function cachedFetch(key, fetcher) {
      if (listingCache.has(key)) return listingCache.get(key);
      const promise = fetcher().catch(() => null).then((result) => {
        // Don't memoize failures (null / empty) — allow retry later
        if (result === null || (Array.isArray(result) && result.length === 0)) {
          listingCache.delete(key);
          return Array.isArray(result) ? result : null;
        }
        return result;
      });
      listingCache.set(key, promise);
      return promise;
    }

    async function apiGet(path) {
      const response = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }

    // ── API wrapper ─────────────────────────────────────────────────────

    /**
     * List rooms that have archive footage for a season.
     *
     * @param {string} season - e.g. 's03'
     * @returns {Promise<string[]>} Room codes (e.g. 'bar', 'den-ptz'), or [] on failure
     */
    function getRooms$1(season) {
      return cachedFetch(`rooms:${season}`, async () => {
        const data = await apiGet(`/archives/${season}/rooms`);
        return data?.rooms || [];
      }).then(r => r || []);
    }

    /**
     * List days with footage for a room in a season.
     *
     * @param {string} season - e.g. 's03'
     * @param {string} room - e.g. 'bar'
     * @returns {Promise<string[]>} ISO dates (e.g. '2024-10-27'), or [] on failure
     */
    function getDays(season, room) {
      return cachedFetch(`days:${season}/${room}`, async () => {
        const data = await apiGet(`/archives/${season}/${room}/days`);
        return data?.days || [];
      }).then(r => r || []);
    }

    /**
     * List video chunks for a room on a given day, sorted by start time.
     *
     * @param {string} season - e.g. 's03'
     * @param {string} room - e.g. 'bar'
     * @param {string} day - ISO date, e.g. '2024-10-27'
     * @returns {Promise<Array<{fileName: string, startsAt: string, hour: number, size: number}>>}
     *   Chunk listing, or [] on failure. startsAt is naive show time
     *   (e.g. '2024-10-27T17:39:31') — parse with parseShowTime().
     */
    function getVideos(season, room, day) {
      return cachedFetch(`videos:${season}/${room}/${day}`, async () => {
        const data = await apiGet(`/archives/${season}/${room}/${day}/videos`);
        const videos = data?.videos || [];
        return videos.slice().sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1));
      }).then(r => r || []);
    }

    /**
     * Request a signed playback URL for an archive video.
     *
     * URLs are signed per-file with an hours-scale expiry — request at
     * play time and re-request if playback errors (expired token).
     * NOT cached. Requires being logged in with a season pass (s01 is
     * marked free by the site).
     *
     * @param {string} season - e.g. 's03'
     * @param {string} room - e.g. 'bar'
     * @param {string} day - ISO date, e.g. '2024-10-27'
     * @param {string} fileName - e.g. 's03_bar_24-10-27_17-39-31.mp4'
     * @returns {Promise<string|null>} Signed URL, or null on failure
     */
    async function getWatchUrl(season, room, day, fileName) {
      try {
        const response = await fetch(`${API_BASE}/archives/watch`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ season, room, day, fileName }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data?.url || null;
      } catch (err) {
        debugLog('archives.getWatchUrl failed:', err.message);
        return null;
      }
    }

    // ── Filename / label helpers ────────────────────────────────────────

    const VIDEO_ID_PATTERN = /^(s\d{2})_([a-z0-9-]+)_(\d{2})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/i;

    /**
     * Parse an archive video ID or filename into its parts.
     *
     * @param {string} idOrFileName - e.g. 's03_bar_24-10-27_17-39-31' or with '.mp4'
     * @returns {{season: string, room: string, day: string, fileName: string, startsAt: string}|null}
     */
    function parseVideoId(idOrFileName) {
      if (!idOrFileName) return null;
      const id = String(idOrFileName).replace(/\.mp4$/i, '');
      const m = id.match(VIDEO_ID_PATTERN);
      if (!m) return null;
      const [, season, room, yy, mo, dd, hh, mi, ss] = m;
      const day = `20${yy}-${mo}-${dd}`;
      return {
        season,
        room,
        day,
        fileName: `${id}.mp4`,
        startsAt: `${day}T${hh}:${mi}:${ss}`,
      };
    }

    const THUMBNAIL_BASE = 'https://cdn.fishtank.live/archive-thumbnails/primary';
    const THUMBNAIL_INTERVAL_S = 5;

    /**
     * Build the public thumbnail URL for a moment within an archive chunk.
     *
     * Thumbnails are pre-generated JPEG frames on the public CDN — no auth,
     * no token — one frame per 5 seconds of footage, indexed from 0:
     *   {base}/{room}/{day}/{videoId}/{N}.jpg
     * (The site uses them as tile previews and video posters.)
     *
     * Coverage is not guaranteed for every chunk (frames appear to be
     * generated as the site's re-run replays footage) — always attach an
     * onerror fallback when displaying.
     *
     * @param {string} idOrFileName - e.g. 's03_bar_24-10-27_17-39-31.mp4'
     * @param {number} [offsetSeconds=0] - Moment within the chunk
     * @returns {string|null} Thumbnail URL, or null if the ID is unparseable
     */
    function thumbnailUrl(idOrFileName, offsetSeconds = 0) {
      const parsed = parseVideoId(idOrFileName);
      if (!parsed) return null;
      const n = Math.max(0, Math.floor(offsetSeconds / THUMBNAIL_INTERVAL_S));
      const id = parsed.fileName.replace(/\.mp4$/i, '');
      return `${THUMBNAIL_BASE}/${parsed.room}/${parsed.day}/${id}/${n}.jpg`;
    }

    /**
     * Convert a room code to a display label ('den-ptz' → 'Den PTZ').
     *
     * @param {string} room
     * @returns {string}
     */
    function formatRoomLabel(room) {
      if (!room) return '?';
      return room
        .split('-')
        .map(part => (part === 'ptz' ? 'PTZ' : part.charAt(0).toUpperCase() + part.slice(1)))
        .join(' ');
    }

    // ── Time helpers ────────────────────────────────────────────────────
    // Two frames:
    //  - STAMP frame: the UTC timestamps encoded in filenames/listings.
    //    Used for all scheduling math and day-folder lookups.
    //  - HOUSE frame: real America/New_York local time (DST-aware).
    //    Used for anything shown to a human.

    /**
     * Parse a naive archive timestamp ('2024-10-27T17:39:31') to epoch ms.
     * Stamps are UTC (see module header).
     *
     * @param {string} timestamp
     * @returns {number} Epoch ms (NaN if unparseable)
     */
    function parseShowTime(timestamp) {
      return Date.parse(`${timestamp}Z`);
    }

    /**
     * Format an epoch-ms moment as a stamp-frame (UTC) ISO date
     * '2024-10-27'. This is the frame the archive's day folders use —
     * always use this (not the house date) to pick a day listing.
     *
     * @param {number} ms - Epoch ms
     * @returns {string}
     */
    function formatShowDate(ms) {
      return new Date(ms).toISOString().slice(0, 10);
    }

    // 'sv' locale reliably formats as 'YYYY-MM-DD HH:mm:ss'.
    function houseWallString(ms) {
      return new Date(ms).toLocaleString('sv', { timeZone: HOUSE_TZ }).replace(' ', 'T');
    }

    /**
     * Parse a naive HOUSE-local timestamp ('2024-11-15T18:00:00' meaning
     * 6pm at the show location) to epoch ms, DST-aware.
     *
     * @param {string} timestamp
     * @returns {number} Epoch ms (NaN if unparseable)
     */
    function parseHouseTime(timestamp) {
      const utcGuess = Date.parse(`${timestamp}Z`);
      if (Number.isNaN(utcGuess)) return NaN;
      // Two-pass zone conversion: correct the guess by the house offset at
      // the guessed moment, then re-check at the corrected moment in case
      // the guess straddled a DST transition.
      let ms = utcGuess + (utcGuess - Date.parse(`${houseWallString(utcGuess)}Z`));
      ms += utcGuess - Date.parse(`${houseWallString(ms)}Z`);
      return ms;
    }

    /**
     * Format an epoch-ms moment as a house-local clock — 'HH:MM:SS' by
     * default, or 'H:MM:SS AM/PM' with hour12.
     *
     * @param {number} ms - Epoch ms
     * @param {boolean} [hour12=false] - 12-hour clock with AM/PM suffix
     * @returns {string}
     */
    function formatHouseClock(ms, hour12 = false) {
      const t = houseWallString(ms).slice(11, 19);
      if (!hour12) return t;
      const h = Number(t.slice(0, 2));
      return `${((h + 11) % 12) + 1}${t.slice(2)} ${h >= 12 ? 'PM' : 'AM'}`;
    }

    /**
     * Format an epoch-ms moment as a house-local ISO date '2024-11-15'.
     *
     * @param {number} ms - Epoch ms
     * @returns {string}
     */
    function formatHouseDate(ms) {
      return houseWallString(ms).slice(0, 10);
    }

    // ── Share codes ─────────────────────────────────────────────────────
    // A share code pins a moment in a season to a compact, human-readable
    // string that means the same real moment for everyone:
    //
    //   FTL1-s03-D11-181745-kitchen
    //   └┬─┘ └┬┘ └┬┘ └─┬──┘ └──┬──┘
    // version season day HHMMSS room (optional)
    //
    // Day and time are HOUSE time (see above), so a code reads naturally
    // in chat AND resolves to the same absolute moment for every user.
    // The seconds pair is optional on parse (early codes were HHMM and
    // resolve to :00), but always emitted — a shared moment is a moment.
    // Codes also travel as links via the URL fragment:
    // https://fishtank.live/#FTL1-s03-D11-181745-kitchen (fragments never
    // reach the server; extensions pick them up client-side).

    const SHARE_CODE_RE = /^FTL1-(s\d{2})-D(\d{1,2})-(\d{2})(\d{2})(\d{2})?(?:-([a-z0-9-]+))?$/i;

    /**
     * Build a share code from structured fields.
     *
     * @param {{season: string, day: number, time: string, room?: string|null}} parts
     *   - season e.g. 's03'; day 1-based; time 'HH:MM:SS' house-local 24h
     *     ('HH:MM' also accepted, meaning :00); room code or null for
     *     "land on the grid"
     * @returns {string} e.g. 'FTL1-s03-D11-181745-kitchen'
     */
    function buildShareCode({ season, day, time, room }) {
      return `FTL1-${season}-D${day}-${time.replace(/:/g, '')}${room ? `-${room}` : ''}`;
    }

    /**
     * Parse a share code or share link. Accepts bare codes, full URLs, and
     * '#'-prefixed fragments; case-insensitive; whitespace-tolerant.
     *
     * @param {string} input
     * @returns {{season: string, day: number, time: string, room: string|null}|null}
     *   null if the input isn't a valid code. time is always 'HH:MM:SS'
     *   (seconds-less codes resolve to :00).
     */
    function parseShareCode(input) {
      if (typeof input !== 'string') return null;
      let str = input.trim();
      const hashIdx = str.indexOf('#');
      if (hashIdx !== -1) str = str.slice(hashIdx + 1);
      const m = str.match(SHARE_CODE_RE);
      if (!m) return null;
      const day = parseInt(m[2], 10);
      const hh = parseInt(m[3], 10);
      const mm = parseInt(m[4], 10);
      const ss = m[5] ? parseInt(m[5], 10) : 0;
      if (day < 1 || hh > 23 || mm > 59 || ss > 59) return null;
      return {
        season: m[1].toLowerCase(),
        day,
        time: `${m[3]}:${m[4]}:${m[5] || '00'}`,
        room: m[6] ? m[6].toLowerCase() : null,
      };
    }

    /**
     * The clickable-link form of a share code.
     *
     * @param {string} code
     * @returns {string}
     */
    function shareUrl(code) {
      return `https://fishtank.live/#${code}`;
    }

    // ── Schedule helpers ────────────────────────────────────────────────

    /**
     * Find the chunk that covers a given moment, from a day's video listing.
     *
     * Returns the latest chunk whose startsAt is <= timeMs, with the seek
     * offset into it. The offset may exceed the chunk's real duration when
     * the moment falls in a gap — the player must validate against the
     * video element's duration once metadata loads (and treat overshoot
     * as "No Signal"). nextStartsAtMs is the following chunk's start
     * (null if this is the last chunk of the listing).
     *
     * @param {Array<{fileName: string, startsAt: string}>} videos - Sorted day listing
     * @param {number} timeMs - Epoch ms (use parseShowTime / a virtual clock)
     * @returns {{video: object, offsetSeconds: number, nextStartsAtMs: number|null}|null}
     *   null if the listing is empty or timeMs is before the first chunk
     */
    function findChunkAt(videos, timeMs) {
      if (!Array.isArray(videos) || videos.length === 0) return null;
      let found = null;
      let nextStartsAtMs = null;
      for (let i = videos.length - 1; i >= 0; i--) {
        const startMs = parseShowTime(videos[i].startsAt);
        if (startMs <= timeMs) {
          found = videos[i];
          nextStartsAtMs = i + 1 < videos.length
            ? parseShowTime(videos[i + 1].startsAt)
            : null;
          return {
            video: found,
            offsetSeconds: (timeMs - startMs) / 1000,
            nextStartsAtMs,
          };
        }
      }
      return null;
    }

    /**
     * Find the first chunk starting after a given moment, from a day's
     * video listing. Useful for "No Signal" countdowns.
     *
     * @param {Array<{fileName: string, startsAt: string}>} videos - Sorted day listing
     * @param {number} timeMs - Epoch ms
     * @returns {object|null} The next chunk, or null if none starts after timeMs
     */
    function nextChunkAfter(videos, timeMs) {
      if (!Array.isArray(videos)) return null;
      for (const video of videos) {
        if (parseShowTime(video.startsAt) > timeMs) return video;
      }
      return null;
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

      // Auto-detect auth token from cookie — Season Pass rooms require
      // authentication, the server silently ignores room switches from
      // anonymous connections
      const socket = createConnection();
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
          resolve(true);
        });

        socket.on('disconnect', (reason) => {
          entry.connected = false;
        });

        // Note: auto-reconnect is disabled on room sockets (see
        // core/socket.js createConnection). Consumers must call
        // chat.rooms.subscribe() again to re-establish a dead room socket.

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

    /**
     * Unsubscribe from all extra rooms.
     */
    function unsubscribeAll() {
      for (const roomName of [...roomSockets.keys()]) {
        cleanup(roomName);
      }
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
    function injectStyles$2() {
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
      injectStyles$2();
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
    function startObserving$1() {
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
      if (startObserving$1()) return true;

      // Wait for the Sonner container to appear
      try {
        await waitForElement(SELECTORS.TOAST_CONTAINER, timeout);
        return startObserving$1();
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

    /**
     * ui/download.js — Browser Download Helpers
     *
     * Triggers a real file download in the user's browser. Uses an
     * in-memory blob URL so the download attribute is honoured and
     * custom filenames work regardless of the source URL's origin.
     *
     * `fromUrl` uses the SDK's transport layer (core/transport.js)
     * to fetch cross-origin resources. The consumer must register
     * a transport first — see core/transport.js for details.
     */


    /**
     * Trigger a browser download for a chunk of bytes.
     *
     * Wraps the bytes in a Blob, creates a same-origin blob: URL,
     * and programmatically clicks a hidden <a download> to trigger
     * the save dialog. The blob URL is revoked after the click so
     * we don't leak memory.
     *
     * @param {Uint8Array|ArrayBuffer|Blob} data - Bytes to download
     * @param {string} filename - Suggested filename for the save dialog
     * @param {string} [mimeType='application/octet-stream'] - MIME type for the blob
     */
    function saveBytes(data, filename, mimeType = 'application/octet-stream') {
        let blob;
        if (data instanceof Blob) {
            blob = data;
        } else if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
            blob = new Blob([data], { type: mimeType });
        } else {
            throw new Error('[ftl-ext-sdk] download.saveBytes requires Uint8Array, ArrayBuffer, or Blob');
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Revoke after a short delay so the browser has time to start
        // the download — revoking synchronously sometimes cancels it.
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /**
     * Download a file from a URL using the registered transport.
     *
     * Fetches the bytes via transport.fetchBytes (which bypasses CORS
     * in extension/userscript contexts) and triggers a browser save
     * dialog with the given filename.
     *
     * Throws if no transport is registered or if the fetch fails.
     *
     * @param {string} url - Absolute URL to download
     * @param {string} filename - Suggested filename for the save dialog
     * @param {string} [mimeType] - MIME type for the blob. Defaults to 'application/octet-stream'.
     * @returns {Promise<void>}
     */
    async function fromUrl(url, filename, mimeType) {
        if (!isRegistered()) {
            throw new Error('[ftl-ext-sdk] download.fromUrl requires a transport. Call transport.register(fn) first.');
        }
        const bytes = await fetchBytes(url);
        saveBytes(bytes, filename, mimeType);
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
        sortInventoryByRarity: false, // CSS-order inventory tiles rarest first
        enablePingIndicator: true,
        // Season Pass monitoring disabled — these don't work reliably and
        // cause problems, so the settings are turned off and hidden for all
        // users. Left commented rather than deleted in case they're revived.
        // monitorSeasonPass: true,
        // monitorSeasonPassXL: true,
        videoStutterImprover: true,
        archiveGridSaver: true,
        // Re-run mode — personal "as live" archive playback
        rerunEnabled: false,
        rerunSeason: 's03',
        rerunAnchorVirtual: null,  // ms, show-time frame (see SDK archives module)
        rerunAnchorReal: null,     // epoch ms when the anchor was set
        rerunTickWhileAway: true,  // clock advances even when off the site
        rerunClickableZones: true, // door zones in the re-run player
        rerunClock12h: false,      // show the re-run clock as 12-hour AM/PM
        rerunSidebarPanel: true,   // Re-run status panel in the site's left sidebar
        rerunPaused: false,
        rerunPausedAtVirtual: null,
        smartAntiSpam: false,
        hideTTSMessages: false,
        hideSFXMessages: false,
        hideStoxMessages: false,
        chatWordFilters: [],
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
        // Merge the changed key onto what's CURRENTLY stored rather than
        // dumping this tab's whole snapshot — another tab (or a newer
        // build) may have written keys this tab's in-memory copy never
        // knew about, and a stale snapshot would wipe them.
        const stored = get(SETTINGS_KEY, null);
        set(SETTINGS_KEY, { ...(stored || {}), [key]: value });
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

    function downloadButton(audioUrl, filename) {
        const btn = document.createElement('button');
        btn.className = 'opacity-40 hover:opacity-100 hover:text-primary-400 cursor-pointer transition-opacity ml-1';
        btn.title = 'Download audio';
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;

        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await fromUrl(audioUrl, filename || 'audio.mp3', 'audio/mpeg');
            } catch (err) {
                console.warn('[FTL-Ext] Download failed:', err.message);
            }
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
        if (audioUrl) {
            header.appendChild(playButton(audioUrl));
            const safeName = (entry.displayName || 'tts').replace(/[^a-z0-9]/gi, '_');
            const safeVoice = (entry.voice || 'voice').replace(/[^a-z0-9]/gi, '_');
            header.appendChild(downloadButton(audioUrl, `tts-${safeVoice}-${safeName}.mp3`));
        }

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
        if (audioUrl) {
            header.appendChild(playButton(audioUrl));
            const safeSound = (entry.message || 'sfx').replace(/[^a-z0-9]/gi, '_');
            header.appendChild(downloadButton(audioUrl, `sfx-${safeSound}.mp3`));
        }

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
        // Deduplicate across tabs — use audioFile + minute-bucket as unique key.
        // audioFile alone collapses repeated preset sounds (same filename every
        // time). The minute bucket lets the same preset be logged again on
        // subsequent plays while still catching cross-tab duplicates.
        const sfxKey = msg.audioFile
            ? `${msg.audioFile}:${Math.floor(Date.now() / 60000)}`
            : null;
        if (sfxKey && sfxLog.some(e => e._dedupKey === sfxKey)) return;

        const entry = {
            displayName: msg.username || '???',
            message: msg.message,
            room: msg.room || '?',
            audioFile: msg.audioFile || null,
            clan: msg.clanTag || null,
            timestamp: Date.now(),
            _dedupKey: sfxKey,
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

                // Delay initial run by a microtask — when opening the
                // craft modal via "Craft" on an inventory item, the
                // pre-selected item name is populated after the item row
                // first renders, so reading synchronously here would miss it.
                Promise.resolve().then(updateHints);

                // Watch the item row for selection changes. We include
                // characterData because the pre-selected item name is
                // sometimes written into an existing text node (not a
                // new child), which wouldn't fire a childList mutation.
                // This was causing the hints to miss the pre-selected
                // item when opening the craft modal from "Craft" on an
                // inventory item.
                const craftObserver = new MutationObserver(updateHints);
                craftObserver.observe(itemRow, { childList: true, subtree: true, characterData: true });
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
     * archive-grid.js — Archive Grid Bandwidth Saver
     *
     * PROBLEM
     * -------
     * The home page renders a grid of ~10 camera tiles, each a full
     * progressive MP4 (150MB–1GB) with preload="auto". preload="auto"
     * makes the browser fetch the ENTIRE file regardless of play/pause
     * state, so all ten download at once — gigabytes of concurrent
     * traffic. Pausing does nothing (the download isn't driven by
     * playback) and setting preload="none" after the fact doesn't abort
     * an in-flight fetch; React also re-asserts preload="auto" on every
     * render.
     *
     * APPROACH (Plan A — posters only)
     * --------------------------------
     * The only reliable way to stop a progressive download is to remove
     * the source. For each grid tile we stash its src in a data attribute,
     * remove the src attribute, and call load() to abort any active fetch.
     * The poster remains, so the grid still shows thumbnails. Clicking a
     * tile is left entirely native: the site promotes that one <video> to
     * the fullscreen slot and plays it there — which we leave untouched.
     *
     * WHY AN OBSERVER (matches zones.js)
     * ----------------------------------
     * React re-adds src on re-render, the thumbnail refresh swaps tiles,
     * and the grid toggles visible/invisible on click. A one-shot pass
     * loses to all three. We observe the persistent page wrapper (never
     * document.body) and re-strip on every mutation, exactly like
     * zones.js watches the player container. A short bounded poll bridges
     * the gap before the wrapper exists on first load, then clears itself.
     *
     * GRID vs FULLSCREEN
     * ------------------
     * When a tile is clicked the site moves that <video> into a fixed,
     * full-width slot and switches it from object-cover to object-contain.
     * We must NOT strip that one. Distinguisher: a tile we should kill is
     * an archive-host <video> with object-cover that is NOT inside the
     * promoted fullscreen button. We treat object-contain (or living in
     * the fixed fullscreen wrapper) as "leave alone".
     */


    // Archive CDN hosts. A <video> pointing here is a camera tile.
    // (The live HLS player uses a different host and is never touched.)
    const ARCHIVE_HOST_RE = /(?:fishtank-archives|fishtank-cameras)\.b-cdn\.net/i;

    // Data attributes for our bookkeeping.
    const STASH_ATTR = 'data-ftl-grid-src';      // where we park the removed src
    const MARK_ATTR = 'data-ftl-grid-stripped';  // marks a tile we've neutralised

    let active$1 = false;
    let observer = null;
    let anchor = null;
    let pollTimer = null;

    /**
     * Is this <video> an archive camera source?
     */
    function isArchiveVideo(video) {
        const src = video.getAttribute('src') || video.getAttribute(STASH_ATTR) || '';
        return ARCHIVE_HOST_RE.test(src);
    }

    /**
     * Should this tile be left playing? True for the promoted fullscreen
     * video. The site switches the clicked tile to object-contain and
     * relocates it into a fixed full-width button; grid tiles stay
     * object-cover. Either signal means "leave alone".
     */
    function isPromotedFullscreen(video) {
        if (video.classList.contains('object-contain')) return true;
        // The fullscreen button is position:fixed and spans most of the
        // viewport; grid tile buttons are not fixed.
        const btn = video.closest('button');
        if (btn && btn.classList.contains('fixed')) return true;
        return false;
    }

    /**
     * Neutralise one grid tile: stash its src, remove it, abort the fetch.
     */
    function stripVideo(video) {
        // Never touch the re-run overlay's player — it lives inside the
        // page wrapper (our observer anchor) and plays from the same
        // archive CDN, but it's deliberately streaming.
        if (video.closest('[data-ftl-sdk="rerun"]')) return;

        // Leave the promoted/fullscreen video alone, and restore its src
        // if we'd previously stripped it (e.g. it just got promoted). When
        // promoting we also resume playback, since we'd called load() which
        // leaves it paused and the site's own play() fired before restore.
        if (isPromotedFullscreen(video)) {
            restoreVideo(video, { resume: true });
            return;
        }

        const liveSrc = video.getAttribute('src');
        if (liveSrc) {
            // Park the current src so we can restore on disable / promotion.
            video.setAttribute(STASH_ATTR, liveSrc);
            video.removeAttribute('src');
            video.setAttribute(MARK_ATTR, '1');
            try {
                video.preload = 'none';
                video.load(); // abort any in-flight progressive download
            } catch {}
        } else if (!video.hasAttribute(MARK_ATTR) && video.hasAttribute(STASH_ATTR)) {
            // Already stripped earlier and React hasn't re-added src — keep marked.
            video.setAttribute(MARK_ATTR, '1');
        }
    }

    /**
     * Restore a tile's src. Used on teardown, or when a tile is promoted to
     * fullscreen so the site can play it.
     *
     * With { resume: true } we also restore preload, call load() to pick up
     * the re-added src, and play() — because stripping left the element
     * paused with no source, and the site's click-time play() already fired
     * and failed before we restored.
     */
    function restoreVideo(video, { resume = false } = {}) {
        const stashed = video.getAttribute(STASH_ATTR);
        const needsSrc = stashed && !video.getAttribute('src');
        if (needsSrc) {
            video.setAttribute('src', stashed);
        }
        video.removeAttribute(STASH_ATTR);
        video.removeAttribute(MARK_ATTR);

        if (resume && stashed) {
            try {
                video.preload = 'auto';
                video.load();
                const p = video.play();
                if (p && typeof p.catch === 'function') p.catch(() => {});
            } catch {}
        }
    }

    /**
     * Scan the anchor for archive videos and strip every grid tile.
     */
    function scan() {
        if (!active$1 || !anchor || !observer) return;

        // Pause our own observer while we mutate tile attributes. Stripping
        // sets/removes src + preload, which would otherwise re-fire this
        // callback in a churn loop — and that churn lands right when the site
        // is rendering the "next camera" countdown placeholder tiles,
        // disturbing them. Disconnect, mutate, then reconnect.
        observer.disconnect();
        try {
            const videos = anchor.querySelectorAll('video');
            for (const v of videos) {
                if (isArchiveVideo(v)) stripVideo(v);
            }
        } finally {
            observer.observe(anchor, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['src', 'class'],
            });
        }
    }

    /**
     * Find the persistent page wrapper the grid renders inside.
     * The home page content lives under <div class="pb-10 ..."> which is
     * present from load and survives the grid re-rendering. We use it as
     * the observer target (never document.body).
     */
    function findAnchor() {
        // Prefer the wrapper that actually contains an archive video.
        const anyTile = [...document.querySelectorAll('video')]
            .find(v => ARCHIVE_HOST_RE.test(v.getAttribute('src') || v.getAttribute(STASH_ATTR) || ''));
        if (anyTile) {
            // Walk up to the pb-10 wrapper if present, else the grid's parent.
            const wrapper = anyTile.closest('div.pb-10') || anyTile.closest('div.grid')?.parentElement;
            if (wrapper) return wrapper;
        }
        // Fall back to the pb-10 wrapper even before tiles exist.
        return document.querySelector('div.pb-10');
    }

    /**
     * Attach the observer to the anchor. Returns true if attached.
     */
    function startObserving() {
        const found = findAnchor();
        if (!found) return false;

        // Re-attach if the anchor changed (React replaced the subtree).
        if (observer && anchor === found) return true;
        if (observer) observer.disconnect();

        anchor = found;
        observer = new MutationObserver(() => scan());
        observer.observe(anchor, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['src', 'class'],
        });

        // Initial pass for tiles already present. (scan() pauses/resumes the
        // observer itself, so it must already be connected here.)
        scan();
        return true;
    }

    // ── Public API ──────────────────────────────────────────────────────

    /**
     * Enable the saver: attach the observer (or bridge with a short poll
     * until the wrapper exists) and strip current tiles.
     */
    function enableArchiveGridSaver() {
        if (active$1) return;
        active$1 = true;

        if (!startObserving()) {
            // Wrapper not in the DOM yet on first load — bounded poll,
            // same pattern as zones.js. Clears itself once attached.
            let attempts = 0;
            pollTimer = setInterval(() => {
                attempts++;
                if (startObserving() || attempts > 40 || !active$1) {
                    clearInterval(pollTimer);
                    pollTimer = null;
                }
            }, 250);
        }
    }

    /**
     * Disable the saver and restore every stripped tile to stock behaviour.
     */
    function disableArchiveGridSaver() {
        if (!active$1) return;
        active$1 = false;

        if (observer) {
            observer.disconnect();
            observer = null;
        }
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
        anchor = null;

        // Restore any tiles we stripped.
        document.querySelectorAll(`video[${STASH_ATTR}]`).forEach(v => restoreVideo(v));
    }

    /**
     * Wire the saver to its setting. Called once from index.js pre-ready so
     * the observer is in place before the grid finishes rendering.
     */
    function initArchiveGridSaver() {
        if (getSetting('archiveGridSaver')) {
            enableArchiveGridSaver();
        }
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

    function createSearchInput(placeholder, items, container, insertAfter, trailing, autoFocus = true) {
        const wrapper = document.createElement('div');
        wrapper.setAttribute('data-ftl-sdk', 'item-search');
        wrapper.className = 'px-1 pb-1';

        const row = document.createElement('div');
        row.className = 'flex items-center gap-2 mt-2 mb-1';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = placeholder;
        input.className = 'font-regular text-md leading-none flex-1 min-w-0 h-[32px] p-1 shadow-md shadow-dark/15 rounded-md bg-gradient-to-t border-1 text-light-text text-shadow-input focus:shadow-lg focus-visible:outline-1 focus-visible:outline-tertiary from-dark-500 via-dark-500 to-dark-600 border-light/50 outline-1 outline-dark/25';

        // Prevent keyboard shortcuts from firing while typing
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });

        row.appendChild(input);
        if (trailing) row.appendChild(trailing);
        wrapper.appendChild(row);
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

        // Auto-focus (skipped for persistent hosts like the sidebar panel,
        // where stealing focus on page load would be hostile)
        if (autoFocus) setTimeout(() => input.focus(), 50);

        return wrapper;
    }

    // ── Inventory popup (floating-ui-portal) ────────────────────────────

    function buildSlotCounter(grid) {
        const counter = document.createElement('span');
        counter.setAttribute('data-ftl-sdk', 'slot-counter');
        counter.className = 'font-regular text-md leading-none opacity-60 tabular-nums text-right min-w-[3.5rem] shrink-0';

        const update = () => {
            const options = grid.querySelectorAll('[role="option"]');
            const used = Array.from(options).filter(o => o.querySelector('img')).length;
            counter.textContent = `${used}/${options.length}`;
        };
        // Initial fill runs before the counter is inserted into the DOM, so
        // only the observer-driven updates check for removal: if a site
        // re-render dropped us, self-clean (the injection pass re-adds).
        update();
        const observer = new MutationObserver(() => {
            if (!counter.isConnected) { observer.disconnect(); return; }
            update();
        });
        observer.observe(grid, { childList: true, subtree: true });
        return { counter, observer };
    }

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
            const { counter, observer: slotCounterObserver } = buildSlotCounter(grid);
            createSearchInput('Search inventory...', items, grid, header, counter);
            inventoryInjected = true;

            // Clean up when inventory closes
            const closeObserver = new MutationObserver(() => {
                if (!portal.contains(dialog)) {
                    closeObserver.disconnect();
                    if (slotCounterObserver) slotCounterObserver.disconnect();
                    inventoryInjected = false;
                }
            });
            closeObserver.observe(portal, { childList: true });
            return;
        }
    }

    // ── Sidebar inventory panel (Aug 2026 site layout) ──────────────────
    // The site moved the inventory from a floating popup into a persistent
    // left sidebar panel. Same img[alt] filtering; the grid's children are
    // a live collection, so filtering tracks items as they change.

    const CHEVRON_DOWN_SVG = '<svg stroke="currentColor" fill="none" stroke-width="48" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="square" d="M112 184l144 144 144-144"></path></svg>';
    const CHEVRON_UP_SVG = '<svg stroke="currentColor" fill="none" stroke-width="48" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="square" d="M112 328l144-144 144 144"></path></svg>';

    /**
     * Compact header button (matches the site's small sidebar buttons)
     * that toggles the inventory grid between its capped height and
     * showing every slot at once.
     */
    function buildExpandButton(grid) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-ftl-sdk', 'inv-expand');
        btn.title = 'Expand inventory';
        btn.className = 'bg-gradient-to-r from-dark-400/75 to-dark-500/75 p-0.5 inline-flex items-center'
            + ' justify-center cursor-pointer rounded-md hover:brightness-105'
            + ' focus-visible:outline-1 focus-visible:outline-tertiary';
        const face = document.createElement('div');
        face.className = 'text-light-text bg-gradient-to-t from-dark-300 to-dark-400'
            + ' active:bg-gradient-to-b active:from-dark-400 active:to-dark-300'
            + ' border-light/25 active:border-light/15 p-0.5 rounded-sm';
        face.innerHTML = CHEVRON_DOWN_SVG;
        btn.appendChild(face);
        btn.addEventListener('click', () => {
            const expanded = grid.style.maxHeight === 'none';
            // Inline style overrides the site's max-h-48 class; clearing it
            // hands control back untouched.
            grid.style.maxHeight = expanded ? '' : 'none';
            face.innerHTML = expanded ? CHEVRON_DOWN_SVG : CHEVRON_UP_SVG;
            btn.title = expanded ? 'Expand inventory' : 'Collapse inventory';
        });
        return btn;
    }

    // Collapsing the panel with its own "-" button unmounts the grid, and
    // reopening mounts a NEW grid element — while our search, counter, and
    // expand button survive in the header, wired to the dead grid. Track
    // the grid we wired so the injection pass can spot that staleness and
    // rebuild against the new grid.
    let sidebarWired = null; // { grid, counterObserver }

    function tryInjectSidebarInventorySearch() {
        if (!getSetting('enableInventorySearch')) return;

        const title = [...document.querySelectorAll('span.font-bold')].find(
            t => t.textContent.trim() === 'Inventory' && t.closest('.shadow-panel'));
        if (!title) return;
        const panel = title.closest('.shadow-panel');

        if (panel.querySelector('[data-ftl-sdk="item-search"]')) {
            if (sidebarWired?.grid?.isConnected) return;
            // Stale — the grid was rebuilt behind our widgets
            panel.querySelector('[data-ftl-sdk="item-search"]')?.remove();
            panel.querySelector('[data-ftl-sdk="inv-expand"]')?.remove();
            sidebarWired?.counterObserver?.disconnect();
            sidebarWired = null;
        }

        const grid = panel.querySelector('[role="option"]')?.closest('.grid');
        if (!grid) return;

        const header = title.parentElement;
        const { counter, observer: counterObserver } = buildSlotCounter(grid);
        createSearchInput('Search inventory...', grid.children, grid, header, counter, false);
        sidebarWired = { grid, counterObserver };

        // Expand/collapse toggle alongside the panel's own header buttons
        const cluster = header.querySelector('.ml-auto');
        if (cluster && !cluster.querySelector('[data-ftl-sdk="inv-expand"]')) {
            cluster.prepend(buildExpandButton(grid));
        }
    }

    // ── Inventory rarity sort ───────────────────────────────────────────
    // The site marks rarity on each tile's inner frame with a border
    // color class (the site's full ItemRarity enum: COMMON white,
    // UNCOMMON green, RARE blue, EPIC purple). Sorting sets CSS `order`
    // on the grid children instead of moving DOM nodes, so React re-renders
    // are never fought — the order survives them, and a scoped observer
    // reapplies it as items come and go.

    const RARITY_RANKS = [
        ['border-purple-600', 1], // epic
        ['border-blue-500', 2],   // rare
        ['border-green-500', 3],  // uncommon
        ['border-white/75', 4],   // common
    ];
    const RANK_UNKNOWN = 0; // unrecognised color — likely a newer, rarer tier
    const RANK_EMPTY = 5;   // empty slots last

    function tileRank(tile) {
        const frame = tile.querySelector('img')?.parentElement;
        if (!frame) return RANK_EMPTY;
        for (const [cls, rank] of RARITY_RANKS) {
            if (frame.classList.contains(cls)) return rank;
        }
        return RANK_UNKNOWN;
    }

    const sortObservers = new Map(); // grid element → MutationObserver

    function applyOrders(grid) {
        for (const tile of grid.children) {
            const order = String(tileRank(tile));
            if (tile.style.order !== order) tile.style.order = order;
        }
    }

    function clearOrders(grid) {
        for (const tile of grid.children) tile.style.order = '';
    }

    // Both inventory hosts: the sidebar panel grid and (older layout)
    // the floating popup's listbox.
    function findInventoryGrids() {
        const grids = [];
        const title = [...document.querySelectorAll('span.font-bold')].find(
            t => t.textContent.trim() === 'Inventory' && t.closest('.shadow-panel'));
        const sidebarGrid = title?.closest('.shadow-panel')
            ?.querySelector('[role="option"]')?.closest('.grid');
        if (sidebarGrid) grids.push(sidebarGrid);
        for (const portal of document.querySelectorAll('[data-floating-ui-portal]')) {
            const dialog = portal.querySelector('[role="dialog"]');
            const popupTitle = dialog?.querySelector('.font-bold');
            if (popupTitle?.textContent.trim() !== 'Inventory') continue;
            const grid = dialog.querySelector('[role="listbox"]');
            if (grid) grids.push(grid);
        }
        return grids;
    }

    function tryApplyInventorySort() {
        if (!getSetting('sortInventoryByRarity')) return;
        // Prune entries whose grid was unmounted (e.g. panel collapsed) —
        // their observers will never fire again
        for (const [grid, observer] of sortObservers) {
            if (!grid.isConnected) {
                observer.disconnect();
                sortObservers.delete(grid);
            }
        }
        for (const grid of findInventoryGrids()) {
            if (sortObservers.has(grid)) continue;
            applyOrders(grid);
            const observer = new MutationObserver(() => {
                if (!grid.isConnected) {
                    observer.disconnect();
                    sortObservers.delete(grid);
                    return;
                }
                applyOrders(grid);
            });
            observer.observe(grid, { childList: true, subtree: true });
            sortObservers.set(grid, observer);
        }
    }

    function removeInventorySort() {
        for (const [grid, observer] of sortObservers) {
            observer.disconnect();
            if (grid.isConnected) clearOrders(grid);
        }
        sortObservers.clear();
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
     * rerun.js — Re-run mode: virtual clock + schedule state
     *
     * Personal "as live" archive playback. The user anchors a virtual
     * clock to a moment in a past season (day + time, show-time frame);
     * this module keeps that clock ticking in real time, persists it
     * across sessions, and resolves what's "on air" per room at the
     * current virtual moment using the SDK archives module.
     *
     * All timestamps are epoch ms in the show-time frame (parsed with the
     * SDK's fixed -04:00 convention). The UI layer (rerun-ui.js) owns all
     * DOM; this module owns state and data.
     *
     * CLOCK MODEL:
     * - anchorVirtual/anchorReal pair: virtualNow = anchorVirtual + (now - anchorReal)
     * - Pause freezes the clock at pausedAtVirtual; resume re-derives the
     *   anchor pair so the clock continues from where it was frozen.
     * - "Tick while away" (default on): live-TV simulation — time passes
     *   even when the site is closed. When off, a heartbeat persists a
     *   last-seen timestamp and on startup the anchor is shifted forward
     *   by the time spent away, so the clock only advances while on site.
     */


    const LAST_SEEN_KEY = 'rerun-last-seen';
    const HEARTBEAT_MS = 15000;

    // Fallback chunk length for on-air heuristics before video metadata
    // is available (s03 chunks are ~15 min; give a little slack).
    const NOMINAL_CHUNK_MS = 16 * 60 * 1000;

    /**
     * Analyse a day's listing: typical chunk length (median spacing
     * between consecutive chunks — season chunking varies) and the
     * stream's typical byte rate (from full-length chunks). The byte
     * rate lets us spot chunks whose footage is much shorter than their
     * schedule slot (camera died mid-chunk) — start times alone can't
     * reveal that, but the file being far smaller than its neighbours can.
     */
    function analyzeListing(videos) {
        const result = { nominalChunkMs: NOMINAL_CHUNK_MS, bytesPerMs: null };
        if (!Array.isArray(videos) || videos.length < 2) return result;
        const diffs = [];
        for (let i = 1; i < videos.length; i++) {
            diffs.push(parseShowTime(videos[i].startsAt)
                - parseShowTime(videos[i - 1].startsAt));
        }
        const sorted = diffs.slice().sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        // Median spacing ≈ chunk duration + ~1s seam. Keep slack tight
        // (a few seconds) so tiles flip to No Signal promptly; the
        // focused player refines against real duration anyway. Capped so
        // a gappy day can't inflate the estimate absurdly.
        result.nominalChunkMs = Math.min(median + 5000, 2 * 3600000);

        // Byte rate estimate. size/spacing equals the true byte rate only
        // when a chunk is immediately followed by the next (back-to-back);
        // any dead air between chunks makes the ratio undershoot. So take
        // a high percentile of the ratios — on s03's uniform grid every
        // pair is back-to-back and this converges on the real bitrate; on
        // s01's motion-triggered clips the tight pairs reveal it.
        const ratios = [];
        for (let i = 1; i < videos.length; i++) {
            const size = videos[i - 1].size;
            if (size && diffs[i - 1] >= 45000) {
                ratios.push(size / diffs[i - 1]);
            }
        }
        if (ratios.length) {
            ratios.sort((a, b) => a - b);
            result.bytesPerMs = ratios[Math.floor((ratios.length - 1) * 0.9)];
        }
        return result;
    }

    // ── Season data (cached per loaded season) ──────────────────────────

    /**
     * Seasons the re-run supports. Extend as the site adds archives.
     */
    const AVAILABLE_SEASONS = [
        { value: 's01', label: 'Season 1' },
        { value: 's03', label: 'Season 3' },
    ];

    let seasonRooms = [];   // room codes from the API
    let seasonDays = [];    // ISO dates, contiguous, index 0 = Day 1
    let loadedSeason = null; // which season the above belong to

    /**
     * Load rooms + days for the configured season. Safe to call
     * repeatedly — refetches only when the season setting has changed
     * since the last successful load (SDK memoizes the underlying
     * requests too). Returns true when data is available.
     */
    async function loadSeasonData() {
        const season = getSetting('rerunSeason');
        if (loadedSeason === season) return true;
        const rooms = await getRooms$1(season);
        if (!rooms.length) return false;

        // Day range comes from a reference room's listing. Use the first
        // room that returns days (rooms should all share the season range).
        let days = [];
        for (const room of rooms) {
            days = await getDays(season, room);
            if (days.length) break;
        }
        if (!days.length) return false;

        seasonRooms = rooms;
        seasonDays = days;
        loadedSeason = season;
        return true;
    }

    /**
     * Switch to a different season. Clears the anchor (day/time positions
     * are meaningless across seasons) and any paused state; the caller
     * should reload season data and prompt for a new start point.
     */
    function changeSeason(season) {
        if (season === getSetting('rerunSeason')) return;
        updateSetting('rerunSeason', season);
        updateSetting('rerunAnchorVirtual', null);
        updateSetting('rerunAnchorReal', null);
        updateSetting('rerunPaused', false);
        updateSetting('rerunPausedAtVirtual', null);
    }

    function getSeasonRooms() { return seasonRooms; }
    function getSeasonDays() { return seasonDays; }

    /**
     * Season bounds in epoch ms: [house-local midnight of the first day,
     * house-local midnight after the last day). Day numbers, the picker,
     * and the clock all live in HOUSE time (real America/New_York local,
     * DST-aware) — the archive's UTC stamps are an internal detail.
     */
    function getSeasonBounds() {
        if (!seasonDays.length) return null;
        const start = parseHouseTime(`${seasonDays[0]}T00:00:00`);
        const end = parseHouseTime(`${seasonDays[seasonDays.length - 1]}T00:00:00`) + 86400000;
        return { start, end };
    }

    /**
     * Convert a season day number (1-based) + 'HH:MM' or 'HH:MM:SS'
     * HOUSE-local time string to epoch ms. Returns null if out of range
     * or unparseable.
     */
    function dayTimeToVirtualMs(dayNumber, timeStr) {
        const day = seasonDays[dayNumber - 1];
        if (!day || !/^\d{2}:\d{2}(:\d{2})?$/.test(timeStr)) return null;
        const time = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
        const ms = parseHouseTime(`${day}T${time}`);
        return Number.isNaN(ms) ? null : ms;
    }

    /**
     * Day number (1-based) for a virtual moment, by HOUSE-local date —
     * the day rolls over at real local midnight, not stamp midnight.
     */
    function virtualMsToDayNumber(ms) {
        const date = formatHouseDate(ms);
        const idx = seasonDays.indexOf(date);
        return idx === -1 ? null : idx + 1;
    }

    // ── Virtual clock ───────────────────────────────────────────────────

    /**
     * Format a virtual moment as the house-local clock, honouring the
     * user's 12/24-hour preference. Use for all human-facing clocks.
     */
    function formatClock(ms) {
        return formatHouseClock(ms, !!getSetting('rerunClock12h'));
    }

    // ── Shared-moment preview ───────────────────────────────────────────
    // A share code opens as a PREVIEW: an in-memory anchor that overrides
    // the stored one while active. The user's own re-run is a pure
    // function of wall clock + stored anchor, so it keeps "airing"
    // untouched underneath — discarding the preview returns to it exactly
    // where it would have been. Nothing here is persisted: a refresh
    // always lands back on the user's own re-run.

    let preview = null; // { anchorVirtual, anchorReal, paused, pausedAtVirtual }

    function isPreviewActive() {
        return !!preview;
    }

    /**
     * Start previewing a virtual moment (lands playing).
     */
    function startPreview(virtualMs) {
        preview = { anchorVirtual: virtualMs, anchorReal: Date.now(), paused: false, pausedAtVirtual: null };
    }

    /**
     * Discard the preview — the stored re-run takes over again.
     */
    function endPreview() {
        preview = null;
    }

    /**
     * Whether re-run mode is enabled AND has a usable anchor.
     */
    function isRerunActive() {
        if (preview) return true;
        return !!(getSetting('rerunEnabled')
            && getSetting('rerunAnchorVirtual') != null
            && getSetting('rerunAnchorReal') != null);
    }

    /**
     * Current virtual moment (show-time epoch ms), or null if no anchor.
     */
    function virtualNow() {
        if (preview) {
            return preview.paused
                ? preview.pausedAtVirtual
                : preview.anchorVirtual + (Date.now() - preview.anchorReal);
        }
        if (getSetting('rerunPaused') && getSetting('rerunPausedAtVirtual') != null) {
            return getSetting('rerunPausedAtVirtual');
        }
        const anchorVirtual = getSetting('rerunAnchorVirtual');
        const anchorReal = getSetting('rerunAnchorReal');
        if (anchorVirtual == null || anchorReal == null) return null;
        return anchorVirtual + (Date.now() - anchorReal);
    }

    /**
     * Set the anchor to a virtual moment, starting the clock from it now.
     * Clears any paused state.
     */
    function setAnchor(virtualMs) {
        updateSetting('rerunAnchorVirtual', virtualMs);
        updateSetting('rerunAnchorReal', Date.now());
        updateSetting('rerunPaused', false);
        updateSetting('rerunPausedAtVirtual', null);
    }

    /**
     * Clear the start point entirely — re-run is inactive until a new
     * anchor is set.
     */
    function clearAnchor() {
        preview = null;
        updateSetting('rerunAnchorVirtual', null);
        updateSetting('rerunAnchorReal', null);
        updateSetting('rerunPaused', false);
        updateSetting('rerunPausedAtVirtual', null);
    }

    function isPaused() {
        if (preview) return preview.paused;
        return !!getSetting('rerunPaused');
    }

    /**
     * Freeze the virtual clock at its current moment.
     */
    function pause() {
        const now = virtualNow();
        if (now == null) return;
        if (preview) {
            preview.pausedAtVirtual = now;
            preview.paused = true;
            return;
        }
        updateSetting('rerunPausedAtVirtual', now);
        updateSetting('rerunPaused', true);
    }

    /**
     * Shift the virtual clock by deltaMs (negative = backwards), clamped
     * to the season bounds. Preserves paused state — a paused clock stays
     * paused at the nudged moment.
     */
    function nudge(deltaMs) {
        const now = virtualNow();
        if (now == null) return;
        let target = now + deltaMs;
        const bounds = getSeasonBounds();
        if (bounds) target = Math.min(Math.max(target, bounds.start), bounds.end - 1000);
        if (preview) {
            if (preview.paused) preview.pausedAtVirtual = target;
            else startPreview(target);
            return;
        }
        if (isPaused()) {
            updateSetting('rerunPausedAtVirtual', target);
        } else {
            setAnchor(target);
        }
    }

    /**
     * Resume a paused clock from where it was frozen.
     */
    function resume() {
        if (preview) {
            if (preview.pausedAtVirtual != null) startPreview(preview.pausedAtVirtual);
            return;
        }
        const frozenAt = getSetting('rerunPausedAtVirtual');
        if (frozenAt == null) return;
        setAnchor(frozenAt);
    }

    /**
     * True when the virtual clock has run past the end of the season.
     */
    function isPastSeasonEnd() {
        const bounds = getSeasonBounds();
        const now = virtualNow();
        return !!(bounds && now != null && now >= bounds.end);
    }

    // ── Away-time handling (tick-while-away off) ────────────────────────

    let heartbeatInterval = null;

    /**
     * Call once on startup, BEFORE the UI reads the clock. If the user
     * has "tick while away" disabled, shift the anchor forward by the
     * time spent away so the clock effectively froze while off-site.
     * Then start the heartbeat that records presence.
     */
    function initClockPersistence() {
        if (isRerunActive() && !getSetting('rerunTickWhileAway') && !isPaused()) {
            const lastSeen = get(LAST_SEEN_KEY, null);
            if (lastSeen) {
                const awayMs = Date.now() - lastSeen;
                if (awayMs > 0) {
                    updateSetting('rerunAnchorReal', getSetting('rerunAnchorReal') + awayMs);
                }
            }
        }

        // Heartbeat runs whenever re-run mode is enabled so that toggling
        // "tick while away" later still has a recent last-seen to work with.
        if (!heartbeatInterval) {
            heartbeatInterval = setInterval(() => {
                if (getSetting('rerunEnabled')) set(LAST_SEEN_KEY, Date.now());
            }, HEARTBEAT_MS);
            if (getSetting('rerunEnabled')) set(LAST_SEEN_KEY, Date.now());
        }
    }

    // ── Schedule resolution ─────────────────────────────────────────────

    /**
     * Resolve a room's state at a virtual moment.
     *
     * Returns one of:
     *   { status: 'on-air', chunk, offsetSeconds, nextStartsAtMs }
     *     — a chunk nominally covers this moment. The player must still
     *       validate offsetSeconds against real video duration.
     *   { status: 'no-signal', nextStartsAtMs }
     *     — downtime; nextStartsAtMs is when footage resumes (may be on
     *       the next day), or null if nothing follows this season.
     *   { status: 'unknown' }
     *     — listings unavailable (API failure / logged out).
     *
     * The on-air decision here is a heuristic (offset within the nominal
     * chunk window); the focused player refines it with real metadata.
     */
    async function getRoomStateAt(room, timeMs) {
        const season = getSetting('rerunSeason');
        const day = formatShowDate(timeMs);

        // Outside the season's day range entirely
        if (!seasonDays.includes(day)) {
            const bounds = getSeasonBounds();
            if (bounds && timeMs < bounds.start) {
                const first = await firstChunkOnOrAfter(room, timeMs);
                return { status: 'no-signal', nextStartsAtMs: first };
            }
            return { status: 'no-signal', nextStartsAtMs: null };
        }

        const videos = await getVideos(season, room, day);
        if (!videos.length) {
            // No footage this day for this room (or fetch failed — the SDK
            // returns [] for both). Look ahead for a countdown target.
            const next = await firstChunkOnOrAfter(room, timeMs);
            return { status: 'no-signal', nextStartsAtMs: next };
        }

        const chunk = findChunkAt(videos, timeMs);
        if (chunk) {
            const { nominalChunkMs, bytesPerMs } = analyzeListing(videos);
            const startMs = parseShowTime(chunk.video.startsAt);
            // Footage length estimated from file size and the listing's
            // byte rate — the only way to see mid-slot dead air, and
            // essential on seasons with motion-triggered clips (s01) where
            // chunk spacing is mostly dead air. 20% + 5s slack absorbs VBR
            // noise; the next chunk's start always caps it. Falls back to
            // typical spacing when sizes are unavailable.
            let nominalEnd;
            if (bytesPerMs && chunk.video.size) {
                nominalEnd = startMs + (chunk.video.size / bytesPerMs) * 1.2 + 5000;
            } else {
                nominalEnd = startMs + nominalChunkMs;
            }
            if (chunk.nextStartsAtMs != null) {
                nominalEnd = Math.min(nominalEnd, chunk.nextStartsAtMs);
            }
            if (timeMs < nominalEnd) {
                return {
                    status: 'on-air',
                    chunk: chunk.video,
                    offsetSeconds: chunk.offsetSeconds,
                    nextStartsAtMs: chunk.nextStartsAtMs,
                    nominalEndMs: nominalEnd,
                };
            }
            // In a gap after this chunk
            if (chunk.nextStartsAtMs != null) {
                return { status: 'no-signal', nextStartsAtMs: chunk.nextStartsAtMs };
            }
        }

        // Before the first chunk of the day, or after the last — find the
        // next chunk today or on a following day.
        const nextToday = nextChunkAfter(videos, timeMs);
        if (nextToday) {
            return { status: 'no-signal', nextStartsAtMs: parseShowTime(nextToday.startsAt) };
        }
        const nextLater = await firstChunkOnOrAfter(room, timeMs, day);
        return { status: 'no-signal', nextStartsAtMs: nextLater };
    }

    /**
     * Find the start (show-time ms) of the first chunk for a room at or
     * after timeMs, scanning forward through the season's days. Skips
     * days at or before afterDay if given. Returns null if none.
     *
     * Bounded to a few days of lookahead to avoid hammering the API for
     * rooms with long dark periods — beyond that the countdown just
     * isn't shown until the clock gets closer.
     */
    const LOOKAHEAD_DAYS = 3;
    async function firstChunkOnOrAfter(room, timeMs, afterDay = null) {
        const season = getSetting('rerunSeason');
        let startIdx = 0;
        if (afterDay) {
            startIdx = seasonDays.indexOf(afterDay) + 1;
        } else {
            const date = formatShowDate(timeMs);
            startIdx = seasonDays.findIndex(d => d >= date);
            if (startIdx === -1) return null;
        }
        const endIdx = Math.min(startIdx + LOOKAHEAD_DAYS, seasonDays.length);
        for (let i = startIdx; i < endIdx; i++) {
            const videos = await getVideos(season, room, seasonDays[i]);
            const next = nextChunkAfter(videos, timeMs);
            if (next) return parseShowTime(next.startsAt);
        }
        return null;
    }

    /**
     * Fetch a signed playback URL for a chunk. Thin passthrough — the
     * URL is signed per-file and must not be cached long-term.
     */
    function getChunkUrl(chunk) {
        const parsed = parseVideoId(chunk.fileName);
        if (!parsed) return Promise.resolve(null);
        return getWatchUrl(parsed.season, parsed.room, parsed.day, parsed.fileName);
    }

    /**
     * rerun-share.js — Share codes for re-run moments
     *
     * The code format itself (FTL1-s03-D11-181745-kitchen) lives in the SDK
     * (archives.buildShareCode / parseShareCode / shareUrl) so other tools
     * can speak it. This module is the extension-side glue: resolving the
     * re-run's virtual clock to the day/time fields a code carries.
     */


    /**
     * Build a share code for a virtual moment. Returns null if the moment
     * doesn't map onto a season day (season data not loaded/out of range).
     */
    function encodeShareCode(season, virtualMs, room) {
        if (virtualMs == null) return null;
        const day = virtualMsToDayNumber(virtualMs);
        if (day == null) return null;
        const time = formatHouseClock(virtualMs); // full HH:MM:SS — the code pins the second
        return buildShareCode({ season, day, time, room });
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
    const STYLE_ID$1 = 'ftl-ext-theatre-styles';
    const BODY_CLASS = 'ftl-theatre-mode';
    const CHAT_WIDTH = 368; // matches site's 2xl:w-[368px]

    let active = false;
    let chatVisible = true;
    let videoContainer = null;
    let controlsContainer = null;
    let chatContainer = null;
    let savedVideoStyles = {};
    let savedControlsStyles = {};
    let savedChatStyles = {};
    let savedChatParentZIndex = '';
    let playerObserver$1 = null;

    /**
     * Find the video player's outermost container.
     *
     * Live (HLS): the .fixed.bg-dark element that contains #live-stream-player.
     * VOD/archive: there is no #live-stream-player — the site promotes the
     * clicked tile's <video> into an id-less fixed wrapper. Grid tile videos
     * sit in static wrappers, so "a <video> with a .fixed ancestor" uniquely
     * identifies the promoted player (our own overlay players are excluded
     * via data-ftl-sdk).
     */
    function findVideoContainer() {
        // Re-run mode's focused player: theatre the whole overlay (it owns
        // the video, controls, and zones). Its own layout engine pauses
        // while body.ftl-theatre-mode is set.
        const rerun = document.getElementById('ftl-rerun-overlay');
        if (rerun?.classList.contains('ftl-rerun-focused')) return rerun;

        const player = document.getElementById('live-stream-player');
        if (player) {
            let el = player.parentElement;
            while (el && el !== document.body) {
                if (el.classList.contains('fixed') && (el.classList.contains('bg-dark') || el.style.transform !== undefined)) {
                    return el;
                }
                el = el.parentElement;
            }
            return player.parentElement?.parentElement || null;
        }
        for (const v of document.querySelectorAll('video')) {
            if (v.closest('[data-ftl-sdk]')) continue;
            const wrap = v.closest('.fixed');
            if (wrap) return wrap;
        }
        return null;
    }

    /**
     * The VOD player renders its controls (close X, volume, day/clock) in a
     * separate fixed pointer-events-none layer, a sibling of the video
     * wrapper. Theatre mode has to reposition it alongside the video or the
     * controls stay stranded at the original player geometry. Identified by
     * the site's close-X icon path. (The live player keeps its controls
     * inside the container, so this returns null there.)
     */
    function findControlsContainer(videoWrap) {
        for (const div of document.querySelectorAll('div.fixed.pointer-events-none')) {
            if (div === videoWrap || videoWrap?.contains(div)) continue;
            if (div.closest('[data-ftl-sdk]')) continue;
            const hasCloseX = [...div.querySelectorAll('svg path')]
                .some(p => (p.getAttribute('d') || '').startsWith('M400 145.49'));
            if (hasCloseX) return div;
        }
        return null;
    }

    /**
     * Find the chat container.
     * It's the .fixed element that contains #chat-input.
     */
    function findChatContainer$1() {
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
    function injectStyles$1() {
        if (document.getElementById(STYLE_ID$1)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID$1;
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

        playerObserver$1 = new MutationObserver(() => {
            if (!videoContainer.isConnected) {
                exitTheatre();
            }
        });

        playerObserver$1.observe(document.body, { childList: true });
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
        // VOD player: keep the detached controls layer glued to the video's
        // theatre geometry (pointer-events stays none; its buttons re-enable
        // themselves with pointer-events-auto).
        if (controlsContainer) {
            controlsContainer.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: ${chatVisible ? `calc(100% - ${CHAT_WIDTH}px)` : '100%'} !important;
            height: 100% !important;
            z-index: 52 !important;
            margin: 0 !important;
            transform: none !important;
            pointer-events: none !important;
        `;
        }
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
        chatContainer = findChatContainer$1();

        if (!videoContainer) {
            notify('Theatre mode unavailable', {
                description: 'No video player found',
                type: 'error',
                duration: 3000,
            });
            return;
        }

        controlsContainer = findControlsContainer(videoContainer);

        // Save original styles
        savedVideoStyles = saveStyles(videoContainer);
        if (controlsContainer) savedControlsStyles = saveStyles(controlsContainer);
        if (chatContainer) {
            savedChatStyles = saveStyles(chatContainer);
            if (chatContainer.parentElement && chatContainer.parentElement !== document.body) {
                savedChatParentZIndex = chatContainer.parentElement.style.zIndex;
            }
        }

        injectStyles$1();
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
        if (playerObserver$1) {
            playerObserver$1.disconnect();
            playerObserver$1 = null;
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
        if (controlsContainer) {
            restoreStyles(controlsContainer, savedControlsStyles);
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
        controlsContainer = null;
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
     * Inject theatre + fullscreen buttons into the site's VOD player
     * controls. The live (HLS) player ships its own theatre/fullscreen
     * buttons — which we intercept below — but the VOD player's chrome is
     * only X + volume + clock, leaving our features hotkey-only there.
     * Called from the global click-injection pass in index.js (the VOD
     * player only ever appears after a click).
     */
    // Icons matching the site's own player buttons (react-icons paths
    // lifted from the site bundle: GiTheaterCurtains and IoExpand).
    const THEATRE_ICON_SVG = '<svg viewBox="0 0 512 512" fill="currentColor" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M18 18v94.275c28.382-12.57 52.994-35.202 71.39-59.734-4.662-3.466-8.973-7.064-12.865-10.79C68.903 34.452 62.723 26.51 58.973 18zm61.754 0c2.378 3.508 5.41 7.103 9.22 10.75 10.73 10.274 26.505 20.414 44.88 29.117C170.602 75.274 217.8 87 256 87s85.398-11.726 122.146-29.133c18.375-8.703 34.15-18.843 44.88-29.117 3.81-3.647 6.842-7.242 9.22-10.75zm373.273 0c-3.75 8.51-9.93 16.452-17.552 23.75-3.892 3.726-8.203 7.324-12.864 10.79 18.396 24.533 43.008 47.166 71.39 59.735V18zm-82.554 16.734C354.78 52.937 308.428 65.326 256 65.33c-52.242-.023-98.44-12.343-114.236-30.463C168.982 45.655 211.206 51.987 256 52c44.953-.022 87.294-6.408 114.473-17.266zM104.785 62.78C83.37 91.92 53.765 118.415 18 131.788v174.035c2.116.805 4.112 1.178 6 1.178 8.312-.646 12.295-5.132 18.324-9.984 29.568-24.024 49.255-66.27 65.053-119.094 9.187-30.72 17.136-64.91 25.34-100.78-2.216-.986-4.41-1.986-6.57-3.01-7.512-3.557-14.67-7.346-21.362-11.35zm302.43 0c-6.693 4.006-13.85 7.795-21.36 11.353-2.162 1.023-4.356 2.023-6.572 3.008 8.204 35.872 16.153 70.062 25.34 100.782 15.798 52.825 35.485 95.07 65.053 119.094 5.414 4.648 11.22 9.89 18.324 9.984 1.888 0 3.884-.373 6-1.178V131.787c-35.764-13.373-65.37-39.87-86.785-69.006zM46.13 317.34C39.233 322.193 31.793 325 24 325c-2.025 0-4.026-.197-6-.564v123.2c6.273 2.01 14.098 3.364 22 3.364 12.41 0 24.637-3.336 30.94-7.316-.04-43.556-.973-88.042-24.81-126.344zm419.74 0c-23.837 38.302-24.77 82.788-24.81 126.344 6.303 3.98 18.53 7.316 30.94 7.316 7.902 0 15.727-1.353 22-3.363v-123.2c-1.974.366-3.975.563-6 .563-7.792 0-15.232-2.807-22.13-7.66zM88.39 409c.6 13.277.61 26.37.61 39v3.73l-2.637 2.633C75.18 465.545 57.5 469 40 469c-7.475 0-14.98-.636-22-2.232V487h476v-20.232c-7.02 1.596-14.525 2.232-22 2.232-17.5 0-35.18-3.455-46.363-14.637L423 451.73V448c0-12.63.01-25.723.61-39z"></path></svg>';
    const EXPAND_ICON_SVG = '<svg viewBox="0 0 512 512" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" d="M432 320v112H320m101.8-10.23L304 304M80 192V80h112M90.2 90.23 208 208M320 80h112v112M421.77 90.2 304 208M192 432H80V320m10.23 101.8L208 304"></path></svg>';

    // Chrome shared by the site-style player buttons (the site's Button
    // component): outer gradient shell + beveled face, per colour variant.
    // "primary" matches the site's own player close (X) button.
    const SITE_BTN_SHELLS = {
        secondary: 'bg-gradient-to-r from-secondary-500 to-secondary-600/75 active:to-secondary-700/90',
        primary: 'bg-gradient-to-r from-primary-400 to-primary-500/90 active:to-primary-600/75',
    };
    const SITE_BTN_FACES = {
        secondary: 'bg-gradient-to-t from-secondary-400 to-secondary-500'
            + ' active:bg-gradient-to-b active:from-secondary-500 active:to-secondary-300',
        primary: 'bg-gradient-to-t from-primary-400 to-primary-500'
            + ' active:bg-gradient-to-b active:from-primary-500 active:to-primary-300',
    };
    const SITE_BTN_SHELL_BASE = 'p-0.5 inline-flex items-center justify-center cursor-pointer'
        + ' rounded-md hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary'
        + ' pointer-events-auto';
    const SITE_BTN_FACE_BASE = 'text-light-text border-light/25 active:border-light/15 rounded-sm'
        + ' flex items-center justify-center h-full w-full';

    /**
     * Build a 32×32 icon button matching the site's player controls.
     */
    function siteIconButton(title, svg, onClick, variant = 'secondary') {
        const b = document.createElement('button');
        b.type = 'button';
        b.title = title;
        b.className = `w-[32px] h-[32px] ${SITE_BTN_SHELLS[variant]} ${SITE_BTN_SHELL_BASE}`;
        b.innerHTML = `<div class="${SITE_BTN_FACES[variant]} ${SITE_BTN_FACE_BASE}">${svg}</div>`;
        b.addEventListener('click', onClick);
        return b;
    }

    /**
     * Same chrome as siteIconButton, but with a text label instead of an
     * icon (width follows the label).
     */
    function siteTextButton(title, text, onClick, variant = 'secondary') {
        const b = document.createElement('button');
        b.type = 'button';
        b.title = title;
        b.className = `h-[32px] ${SITE_BTN_SHELLS[variant]} ${SITE_BTN_SHELL_BASE}`;
        const face = document.createElement('div');
        face.className = `${SITE_BTN_FACES[variant]} ${SITE_BTN_FACE_BASE}`
            + ' px-2 text-sm font-medium whitespace-nowrap leading-none text-shadow-md';
        face.textContent = text;
        b.appendChild(face);
        b.addEventListener('click', onClick);
        return b;
    }

    function tryInjectVodControls() {
        if (!getSetting('enhancedTheatreMode')) return;
        if (document.getElementById('live-stream-player')) return; // live player has native buttons
        const layer = findControlsContainer(null);
        if (!layer || layer.querySelector('[data-ftl-sdk="vod-controls"]')) return;

        // The live player groups theatre/fullscreen with the volume cluster;
        // mirror that by appending to the VOD layer's volume flex row.
        const volumeRow = layer.querySelector('input[type="range"]')?.parentElement;
        if (!volumeRow) return;

        const wrap = document.createElement('div');
        wrap.setAttribute('data-ftl-sdk', 'vod-controls');
        wrap.className = 'flex items-center gap-2 ml-2';
        wrap.appendChild(siteIconButton('Theater Mode (T)', THEATRE_ICON_SVG, () => toggleTheatre()));
        wrap.appendChild(siteIconButton('Fullscreen (F)', EXPAND_ICON_SVG, () => {
            if (document.fullscreenElement) {
                document.exitFullscreen();
                if (active) exitTheatre();
            } else {
                if (!active) enterTheatre();
                document.documentElement.requestFullscreen();
            }
        }));
        volumeRow.appendChild(wrap);
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
     * rerun-zones.js — Clickable room-navigation zones for the re-run player
     *
     * Overlays clickable door/doorway polygons on the focused re-run
     * video: hovering highlights the zone with the target room's name,
     * clicking switches the player to that room.
     *
     * Zone geometry is percentage-based ([x, y] in 0-100 of the video
     * frame) and is scaled to the video's rendered content box, taking
     * object-fit: contain letterboxing into account.
     *
     * Season 1 zone data adapted from the "Fishtank Custom Clickable
     * Zones" userscript v1.1 by @c (MIT licensed):
     * https://greasyfork.org — thank you! Season 3 zones to be added.
     */


    const SVG_NS = 'http://www.w3.org/2000/svg';
    const CONTAINER_ID = 'ftl-rerun-zones';
    const EDITOR_ID = 'ftl-rerun-zone-editor';
    const CUSTOM_ZONES_KEY = 'rerun-custom-zones';
    const HIDDEN_ZONES_KEY = 'rerun-hidden-zones';

    // ── Zone data ───────────────────────────────────────────────────────
    // Keyed by season → room code → zones. points are [x, y] percentages
    // of the video frame; target is the room code to switch to.

    const SEASON_ZONES = {
        s01: {
            'living-room': [
                { points: [[44.756, -0.093], [46.070, 17.588], [51.137, 14.919], [62.208, 17.588], [74.500, 25.595], [74.312, 29.431], [76.658, 31.600], [75.345, 38.606], [90.639, 52.451], [93.829, 36.771], [95.236, 37.939], [99.928, 1.073], [99.271, 0.239]], target: 'kitchen' },
                { points: [[35.291, 0.105], [44.483, -0.133], [45.691, 17.997], [37.371, 23.483]], target: 'laundry' },
                { points: [[37.036, 23.961], [9.661, 44.238], [5.904, 23.245], [35.560, 9.170]], target: 'hallway-down' },
                { points: [[35.425, 8.335], [5.635, 22.648], [2.885, 0.582], [35.023, -0.014]], target: 'hallway-up' },
            ],
            'kitchen': [
                { points: [[76.470, 99.492], [85.478, 67.464], [90.170, 45.779], [92.421, 31.600], [93.078, 28.597], [93.641, 28.931], [95.518, 3.909], [94.017, 0.239], [99.834, 0.573], [99.928, 99.492]], target: 'laundry' },
                { points: [[71.967, 0.072], [69.902, 41.275], [88.387, 51.951], [92.703, 28.430], [93.078, 28.097], [95.143, 4.410], [93.454, 0.239]], target: 'hallway-down' },
                { points: [[69.527, 40.941], [34.810, 18.589], [34.810, 0.072], [71.591, 0.072]], target: 'living-room' },
            ],
            'laundry': [
                { points: [[96.175, 11.082], [94.298, 47.947], [88.387, 85.313], [71.404, 78.140], [74.782, 0.907], [95.330, 0.239]], target: 'kitchen' },
                { points: [[45.038, 99.659], [39.502, 0.072], [0, 0.072], [0.281, 99.325]], target: 'garage' },
                { points: [[71.254, 78.710], [59.244, 99.822], [45.355, 99.584], [40.122, -0.014], [74.474, 0.463]], target: 'kitchen' },
                { points: [[88.718, 85.666], [99.956, 87.547], [99.956, 0.577], [95.725, -0.01], [96.915, 10.331], [94.800, 49.233]], target: 'hallway-down' },
            ],
            'hallway-up': [
                { points: [[61.391, 83.123], [69.845, 99.584], [85.008, 99.703], [99.836, 67.378], [99.970, -0.133], [73.133, -0.014]], target: 'hallway-down' },
                { points: [[36.700, 99.703], [17.780, 8.096], [16.169, 3.683], [11.540, 0.343], [0, -0.014], [0.067, 99.584]], target: 'bedroom-2' },
                { points: [[11.436, -0.128], [22.278, 0.224], [29.616, 63.218], [18.047, 7.276], [16.593, 3.515]], target: 'bedroom-3' },
                { points: [[37.219, 99.652], [61.216, 83.668], [69.480, 99.652], [85.280, 99.769], [99.956, 68.507], [99.824, 99.769]], target: 'bedroom-1' },
                { points: [[37.946, 23.259], [25.385, 22.084], [25.980, 19.028], [30.410, 16.325], [28.955, 0.224], [37.285, -0.01]], target: 'bedroom-4' },
            ],
            'bedroom-1': [
                { points: [[40.927, 41.137], [27.978, 50.083], [24.824, 0.105], [40.927, 0.343]], target: 'hallway-up' },
                { points: [[41.330, 40.302], [56.225, 30.998], [57.097, 0.701], [57.164, 0.105], [41.196, 0.343]], target: 'hallway-down' },
                { points: [[27.777, 50.918], [13.687, 59.983], [7.850, 29.447], [6.575, -0.133], [24.489, -0.014]], target: 'bedroom-2' },
            ],
            'bedroom-3': [
                { points: [[80.520, 4.716], [73.645, 50.904], [84.024, 61.129], [95.593, 4.716]], target: 'hallway-up' },
                { points: [[73.380, 50.787], [47.333, 28.104], [47.598, 3.423], [79.991, 4.599]], target: 'bedroom-4' },
                { points: [[95.990, 4.951], [84.222, 61.364], [70.868, 99.913], [99.824, 99.560], [99.824, 4.364]], target: 'bedroom-2' },
            ],
            'hallway-down': [
                { points: [[32.525, 89.923], [31.401, 52.197], [31.996, 0.133], [62.340, 0.368], [54.077, 80.991]], target: 'hallway-up' },
                { points: [[78.339, 68.155], [84.883, 77.087], [92.552, 43.004], [84.354, 37.833]], target: 'laundry' },
                { points: [[86.007, 22.789], [84.222, 37.362], [92.882, 42.886], [94.601, 29.371]], target: 'kitchen' },
                { points: [[97.708, 10.566], [94.932, 29.136], [93.279, 43.239], [85.082, 77.557], [77.677, 99.887], [99.890, 99.887], [99.956, 13.269]], target: 'living-room' },
            ],
            'bedroom-4': [
                { points: [[27.236, 55.227], [25.385, -0.128], [6.743, 0.341], [14.147, 64.159]], target: 'hallway-up' },
            ],
            'bedroom-2': [
                { points: [[8.660, 73.091], [44.491, 33.719], [43.896, 0.224], [0.198, -0.01], [0, 37.362], [1.123, 46.765]], target: 'bedroom-3' },
                { points: [[82.041, 64.276], [44.755, 33.837], [44.160, 0.459], [92.354, -0.128]], target: 'hallway-up' },
                { points: [[73.050, 99.769], [82.305, 64.394], [92.750, 0.694], [92.750, -0.01], [99.956, -0.01], [99.824, 99.769]], target: 'bedroom-1' },
            ],
        },
        // s03 zones traced by BarryThePirate with the built-in zone editor.
        s03: {
            'bedroom-1': [
                { points: [[17.42, 55.985], [15.819, 46.024], [14.548, 35.143], [13.23, 21.166], [12.429, 8.359], [0.235, 17.148], [1.13, 29.787], [2.825, 42.09], [4.991, 54.98], [6.827, 64.857]], target: 'hallway' },
            ],
            'hallway': [
                { points: [[54.661, 50.377], [53.908, 41.923], [57.486, 42.09], [59.934, 5.514], [64.077, 9.448], [60.075, 49.372]], target: 'bedroom-3' },
                { points: [[38.591, 0.132], [40.891, 0.237], [40.507, 16.484], [40.507, 42.06], [39.122, 52.438], [38.414, 27.176]], target: 'bedroom-2' },
                { points: [[37.088, 70.362], [38.65, 55.006], [37.942, 30.583], [37.942, 17.113], [38.119, 0.552], [34.847, 2.753], [34.876, 26.39], [35.643, 49.66], [36.704, 66.641]], target: 'bedroom-1' },
                { points: [[38.606, 85.363], [46.751, 98.253], [56.827, 84.777], [51.93, 84.693], [51.601, 67.2], [44.209, 67.368], [43.644, 85.614]], target: 'island' },
            ],
            'bedroom-3': [
                { points: [[98.164, 6.602], [99.953, 8.694], [99.906, 98.002], [82.203, 98.588], [85.546, 89.213], [89.783, 73.98], [94.115, 52.804], [96.563, 34.641], [97.881, 18.152]], target: 'vanity' },
                { points: [[80.179, 48.117], [81.073, 39.328], [82.015, 29.535], [82.721, 16.729], [82.91, 6.1], [94.256, 11.707], [93.738, 21.249], [92.985, 31.628], [91.808, 41.839], [91.008, 48.619], [90.395, 53.306]], target: 'hallway' },
            ],
            'vanity': [
                { points: [[33.963, 59.513], [47.082, 53.276], [44.87, -0.077], [26.651, -0.025], [29.983, 33.151]], target: 'bedroom-3' },
            ],
            'bedroom-2': [
                { points: [[82.015, 53.976], [83.145, 45.522], [84.934, 31.377], [86.252, 17.985], [87.1, 6.267], [92.891, 10.285], [99.247, 15.055], [97.411, 33.72], [95.433, 47.363], [92.608, 61.09]], target: 'hallway' },
            ],
            'island': [
                { points: [[12.759, 51.465], [20.527, 41.086], [18.362, 0.575], [8.333, 0.492], [9.134, 24.597], [11.064, 43.848], [11.535, 48.535]], target: 'hallway' },
                { points: [[24.773, 42.753], [29.849, 34.366], [34.156, 28.259], [41.386, 19.052], [55.436, 20.055], [55.59, 0.273], [41.284, 0.091], [22.106, 0], [22.465, 8.022], [22.876, 17.138], [23.491, 25.524], [24.158, 35.187]], target: 'kitchen' },
                { points: [[73.588, 45.689], [80.32, 98.42], [99.906, 98.002], [99.906, 0.241], [76.412, 0.241], [75.565, 16.144], [74.67, 30.791]], target: 'dining-room' },
                { points: [[70.83, 42.707], [56.436, 32.751], [57.271, 0.262], [59.384, 0.349], [65.082, 1.048], [69.16, 2.271], [73.237, 3.493], [72.599, 16.943], [72.206, 24.803], [71.223, 37.817]], target: 'mail-room' },
            ],
            'penthouse': [
                { points: [[31.339, 34.356], [29.924, 2.648], [39.033, 0.918], [39.475, 28.119]], target: 'deck' },
                { points: [[70.165, 45.886], [75.029, 46.935], [80.218, 35.037], [81.22, 12.658], [79.717, 6.684], [75.354, 0.289], [63.974, 0.132], [65.625, 5.74], [71.993, 16.013]], target: 'loft' },
                { points: [[0.141, -0.01], [7.863, -0.01], [7.062, 87.372], [99.953, 87.204], [99.859, 98.085], [0.094, 97.667]], target: 'jacuzzi' },
            ],
            'jacuzzi': [
                { points: [[88.936, 17.566], [84.463, 42.007], [77.966, 67.786], [71.328, 88.46], [67.42, 98.588], [90.348, 98.336], [95.998, 83.271], [99.859, 68.623], [99.812, 28.698]], target: 'penthouse' },
                { points: [[37.665, 36.985], [41.478, 43.597], [43.315, 25.099], [44.962, 8.025], [46.109, 0.394], [41.215, 0.08], [39.475, 14.388], [38.208, 27.962]], target: 'penthouse' },
            ],
            'loft': [
                { points: [[21.94, 18.403], [26.93, 54.896], [4.708, 88.878], [0.282, 76.24], [0.094, 41.337], [9.746, 29.87], [17.985, 21.5]], target: 'jacuzzi' },
                { points: [[24.482, 85.53], [36.582, 63.183], [51.365, 72.055], [72.599, 82.434], [68.832, 98.504], [28.484, 98.42]], target: 'penthouse' },
            ],
            'deck': [
                { points: [[19.444, 62.764], [29.614, 55.733], [38.936, 49.54], [51.977, 41.337], [54.379, 39.663], [64.831, 51.883], [56.073, 59.835], [49.247, 65.861], [38.089, 75.152], [29.849, 81.68], [24.388, 85.865]], target: 'den-ptz' },
                { points: [[61.017, 40.082], [55.979, 26.104], [53.296, 26.606], [53.343, 13.13], [58.051, 5.932], [67.043, 5.43], [66.761, 11.624], [59.981, 13.967], [61.394, 20.077], [65.348, 30.791], [65.066, 37.989]], target: 'den' },
                { points: [[8.427, 0.241], [8.945, 13.465], [10.311, 27.861], [11.911, 41.923], [14.218, 54.98], [18.315, 73.227], [21.987, 88.878], [23.682, 97.751], [0.047, 98.085], [0.141, -0.01]], target: 'penthouse' },
                { points: [[53.193, 27.534], [55.657, 26.967], [60.721, 40.349], [57.573, 42.133], [53.467, 37.916]], target: 'flat' },
            ],
            'den': [
                { points: [[16.594, 33.974], [16.25, 31.354], [15.464, 30.83], [15.169, 26.463], [14.482, 18.69], [13.941, 8.297], [13.548, 0.175], [11.436, 0.087], [7.85, 3.406], [2.593, 9.52], [0.038, 12.838], [-0.011, 49.607], [1.905, 49.432], [5.049, 46.725], [10.601, 40.349]], target: 'den-ptz' },
                { points: [[80.085, 12.126], [79.661, 25.183], [91.949, 25.685], [91.902, 33.218], [98.493, 18.655], [91.62, 7.104], [91.478, 13.047]], target: 'confessional' },
                { points: [[92.043, 35.646], [98.493, 47.531], [92.043, 61.676], [92.043, 55.064], [79.755, 54.227], [80.132, 40.5], [91.902, 40.919]], target: 'dining-room' },
                { points: [[92.279, 66.112], [98.54, 78.5], [92.938, 92.31], [92.844, 86.953], [79.661, 86.033], [79.944, 71.385], [92.279, 71.302]], target: 'locker-room' },
                { points: [[63.435, 31.814], [63.999, 13.036], [64.922, 6.746], [57.231, 5.743], [56.308, 0.091], [73.947, 0.091], [73.383, 19.781], [73.844, 19.508], [73.178, 34.913], [72.255, 34.731], [72.306, 32.999]], target: 'deck' },
                { points: [[54.616, 29.079], [54.513, 18.505], [55.282, 18.323], [57.128, 6.563], [64.256, 7.475], [63.435, 13.491], [62.974, 31.996], [62.666, 30.994]], target: 'flat' },
                { points: [[16.742, 34.148], [16.545, 30.917], [15.661, 30.742], [14.875, 23.231], [14.334, 16.594], [13.745, 5.939], [17.331, 4.454], [20.426, 2.795], [20.966, 11.441], [21.605, 21.747], [22.244, 29.17], [19.64, 31.703]], target: 'lounge' },
            ],
            'kitchen': [
                { points: [[35.405, 18.32], [38.136, 16.06], [44.209, 15.39], [49.812, 15.641], [53.908, 17.985], [52.589, 20.496], [51.601, 20.496], [51.46, 31.544], [50.047, 33.888], [49.435, 35.729], [44.915, 37.152], [39.972, 36.148], [37.476, 32.8], [37.288, 20.747]], target: 'island' },
                { points: [[34.087, 17.399], [39.689, 13.465], [39.623, 0.08], [29.187, 0.08], [30.72, 29.063], [36.38, 22.145]], target: 'dining-room' },
                { points: [[65.23, 8.734], [69.209, 17.205], [64.345, 24.192], [64.591, 20.087], [55.846, 18.079], [56.78, 10.044], [65.131, 12.314]], target: 'hallway' },
                { points: [[4.47, 57.412], [4.069, 55.989], [5.937, 46.857], [5.203, 42.469], [12.742, 34.523], [20.08, 28], [23.349, 24.917], [23.682, 33.693], [18.879, 38.911], [13.476, 45.078], [10.34, 48.992]], target: 'mail-room' },
            ],
            'dining-room': [
                { points: [[7.062, 98.169], [0.047, 98.253], [0.047, 0.073], [11.158, 0.157], [10.829, 9.615], [10.829, 20.161], [11.488, 34.809], [12.524, 47.112], [13.418, 55.482], [13.371, 57.742], [12.147, 57.993], [10.499, 67.786], [9.228, 74.231], [7.815, 85.363], [7.109, 94.57]], target: 'island' },
                { points: [[81.098, 52.227], [82.178, 46.114], [83.456, 38.079], [84.537, 30.044], [85.421, 22.271], [85.765, 17.991], [90.677, 21.397], [95.05, 25.24], [99.864, 29.432], [99.913, 41.135], [98.194, 50.044], [95.983, 61.659], [93.576, 71.266], [89.597, 64.279], [85.617, 58.428]], target: 'den' },
            ],
            'locker-room': [
                { points: [[24.388, 50.042], [30.556, 45.689], [35.97, 42.174], [41.761, 38.575], [42.394, 24.66], [43.072, 11.296], [43.809, 0.132], [22.495, -0.025], [22.406, 9.985], [22.819, 26.233], [23.467, 38.339]], target: 'den' },
                { points: [[0.058, 0], [3.032, 0.273], [3.032, 7.84], [3.852, 19.417], [5.185, 32.999], [7.288, 47.767], [9.287, 57.338], [10.98, 65.451], [13.082, 76.117], [16.107, 88.879], [17.902, 94.622], [17.953, 95.533], [0.006, 95.351]], target: 'catwalk' },
            ],
            'mail-room': [
                { points: [[4.708, 46.526], [3.249, 32.967], [2.542, 22.923], [2.307, 12.042], [2.307, 7.02], [5.885, 4.677], [9.463, 3.003], [11.347, 2.501], [11.299, 16.311], [11.629, 26.941], [12.429, 37.989], [12.947, 43.346]], target: 'catwalk' },
                { points: [[99.953, 56.905], [94.633, 78.416], [91.667, 86.786], [0.282, 87.456], [0.235, 97.918], [99.859, 97.165]], target: 'island' },
                { points: [[30.65, 66.447], [52.307, 56.068], [53.814, 30.707], [55.232, 11.684], [55.98, 0.274], [29.25, 0.195], [29.074, 11.606], [29.162, 30.285], [29.602, 45.057], [29.91, 56.624]], target: 'yard' },
            ],
            'catwalk': [
                { points: [[54.068, 18.633], [56.338, 15.174], [56.28, -0.025], [39.977, 0.08], [40.095, 14.388]], target: 'mail-room' },
                { points: [[6.545, 41.746], [14.682, 35.457], [10.614, 25.289], [9.199, 5.111], [3.096, 8.256], [4.895, 30.111]], target: 'locker-room' },
                { points: [[15.773, 26.966], [24.175, 21.987], [32.99, 17.27], [35.761, 17.218], [42.276, 19.629], [20.637, 34.985]], target: 'yard-ptz' },
                { points: [[22.819, 37.553], [44.133, 20.834], [52.653, 24.451], [62.176, 29.639], [72.199, 34.985], [77.211, 38.339], [69.723, 48.979], [59.788, 62.553], [54.039, 69.628], [45.725, 67.846], [39.269, 59.408], [28.332, 45.572]], target: 'yard' },
            ],
            'den-ptz': [
                { points: [[87.994, 97.165], [87.665, 14.553], [0.188, 12.21], [0.141, 0.575], [99.623, 0.492], [99.812, 96.411]], target: 'den' },
                { points: [[0.088, 13.1], [-0.011, 95.721], [87.632, 96.332], [87.533, 84.978], [6.13, 85.502], [6.474, 12.926]], target: 'lounge' },
            ],
            'yard-ptz': [
                { points: [[0.094, 13.967], [99.765, 14.218], [99.718, -0.01], [0.141, -0.01]], target: 'yard' },
            ],
            'yard': [
                { points: [[39.977, -0.077], [39.888, 13.916], [55.543, 14.073], [55.366, 0.08]], target: 'yard-ptz' },
                { points: [[92.276, 15.803], [91.627, 25.08], [90.153, 38.601], [95.902, 42.742], [97.376, 30.949], [98.113, 20.048]], target: 'flat' },
            ],
            'flat': [
                { points: [[82.392, 31.879], [83.239, 16.562], [83.663, 16.227], [84.369, 6.853], [78.107, 4.76], [77.401, 0.073], [84.981, 0.157], [92.608, 3.589], [92.702, 21.5], [91.478, 37.152]], target: 'den' },
                { points: [[99.906, 24.262], [94.774, 27.61], [92.75, 35.06], [89.689, 46.526], [86.723, 64.773], [87.806, 82.35], [94.915, 95.658], [99.859, 98.504]], target: 'bar' },
                { points: [[82.533, 73.394], [80.132, 96.328], [60.782, 84.108], [67.514, 81.178], [60.075, 52.804], [70.48, 49.874], [77.637, 75.654]], target: 'yard' },
            ],
            'confessional': [
                { points: [[0.282, 98.002], [11.911, 97.834], [12.382, -0.01], [0.188, 0.073]], target: 'den' },
            ],
            'bar': [
                { points: [[75.793, 0.182], [59.743, 0.182], [56.872, 5.287], [57.436, 21.513], [66.255, 27.438], [68.306, 25.068]], target: 'den' },
                { points: [[1.288, 69.553], [1.34, 63.263], [1.75, 52.78], [2.468, 42.844], [3.339, 33.181], [4.878, 30.356], [11.646, 23.701], [23.286, 13.765], [31.131, 8.478], [38.45, 3.434], [56.506, 9.837], [56.916, 17.781], [51.673, 21.348], [41.003, 29.535], [30.288, 38.775], [19.528, 49.07], [12.46, 56.608]], target: 'flat' },
                { points: [[8.159, 87.056], [0.776, 84.686], [4.775, 69.553], [5.647, 73.564], [18.158, 61.714], [21.235, 71.923], [7.8, 83.5]], target: 'yard' },
            ],
            'lounge': [
                { points: [[78.74, 11.965], [81.294, 13.275], [79.771, 25.939], [77.315, 24.279]], target: 'confessional' },
                { points: [[84.684, 28.472], [86.305, 17.991], [89.99, 21.397], [88.27, 31.092]], target: 'dining-room' },
                { points: [[92.2, 20.262], [89.351, 33.45], [96.425, 38.777], [99.471, 24.105]], target: 'den-ptz' },
                { points: [[70.683, 52.314], [85.666, 36.943], [82.375, 32.926], [75.645, 27.948], [69.356, 25.677], [62.773, 26.288], [60.268, 49.52]], target: 'den' },
                { points: [[68.816, 23.144], [64.051, 12.227], [64.984, 1.31], [71.125, 4.716], [67.539, 7.86], [72.107, 17.817], [71.862, 23.755]], target: 'deck' },
                { points: [[63.903, 13.362], [68.177, 23.144], [66.114, 22.969], [63.216, 21.223]], target: 'flat' },
            ],
        },
    };

    // ── State ───────────────────────────────────────────────────────────

    let playerEl$1 = null;
    let videoEl$1 = null;
    let onNavigate = null;
    let currentRoom = null;
    let resizeObserver = null;
    let editing = false;
    let draftPoints = [];
    let getSeason = () => getSetting('rerunSeason');
    let getRooms = getSeasonRooms;
    let getRoomStatus = null;

    /**
     * Bind the zones module to a player. Call from the player builder —
     * re-binding to a new host replaces the previous binding.
     *
     * @param {HTMLElement} player - The focused player container
     * @param {HTMLVideoElement|null} video - The player's video element
     *   (null for a No Signal room — zones assume a 16:9 frame)
     * @param {Function} navigate - navigate(roomCode) switches rooms
     * @param {Object} [opts]
     * @param {Function} [opts.getSeason] - () => season code; defaults to
     *   the personal re-run's season setting
     * @param {Function} [opts.getRooms] - () => room codes for the editor's
     *   target picker; defaults to the personal re-run's season rooms
     * @param {HTMLElement} [opts.buttonMount] - where to put the Zones
     *   editor button when the player has no .ftl-rerun-player-bar (used
     *   when riding the site's own archive player)
     * @param {Function} [opts.getRoomStatus] - (roomCode) => display string
     *   ("● On Air" / "No Signal — 0:38" / '') for the hover label's
     *   status line; omit to hide the status line
     */
    function initZones(player, video, navigate, opts = {}) {
        playerEl$1 = player;
        videoEl$1 = video;
        onNavigate = navigate;
        getSeason = opts.getSeason || (() => getSetting('rerunSeason'));
        getRooms = opts.getRooms || getSeasonRooms;
        getRoomStatus = opts.getRoomStatus || null;
        editing = false;
        draftPoints = [];
        videoEl$1?.addEventListener('loadedmetadata', layoutZones);
        resizeObserver?.disconnect();
        resizeObserver = new ResizeObserver(layoutZones);
        resizeObserver.observe(playerEl$1);

        // Zone editor toggle: our player bar, or a host-supplied mount
        const bar = playerEl$1.querySelector('.ftl-rerun-player-bar');
        if (bar || (opts.buttonMount && !opts.buttonMount.querySelector('[data-ftl-sdk="zones-btn"]'))) {
            const editBtn = siteTextButton(
                'Trace clickable door zones for this room',
                'Zones',
                () => setZoneEditing(!editing)
            );
            if (bar) {
                bar.insertBefore(editBtn, bar.querySelector('.ftl-rerun-spacer'));
            } else {
                editBtn.setAttribute('data-ftl-sdk', 'zones-btn');
                opts.buttonMount.appendChild(editBtn);
            }
        }
    }

    /**
     * Show zones for a room (or clear with null). Call on room change.
     */
    function setZonesRoom(room) {
        currentRoom = room;
        if (editing) setZoneEditing(false);
        renderZones();
    }

    /**
     * Re-render for the current room — used when the setting toggles.
     */
    function refreshZones() {
        renderZones();
    }

    // ── Rendering ───────────────────────────────────────────────────────

    function getCustomZones() {
        return get(CUSTOM_ZONES_KEY, {});
    }

    function getHiddenZones() {
        return get(HIDDEN_ZONES_KEY, {});
    }

    // Identity key for a zone — used to match deletions against the
    // built-in data without copying it into storage.
    function zoneKey(zone) {
        return JSON.stringify({ points: zone.points, target: zone.target });
    }

    function getZonesForRoom(room) {
        if (!room || (!editing && !getSetting('rerunClickableZones'))) return [];
        const season = getSeason();
        const hidden = new Set(getHiddenZones()[season]?.[room] || []);
        const builtIn = (SEASON_ZONES[season]?.[room] || []).filter(z => !hidden.has(zoneKey(z)));
        const custom = (getCustomZones()[season]?.[room] || []).map(z => ({ ...z, custom: true }));
        const zones = [...builtIn, ...custom];
        // Only offer rooms that exist in this season's archive
        const known = getRooms();
        return known.length ? zones.filter(z => known.includes(z.target)) : zones;
    }

    function renderZones() {
        if (!playerEl$1) return;
        playerEl$1.querySelector(`#${CONTAINER_ID}`)?.remove();
        const zones = getZonesForRoom(currentRoom);
        if (!zones.length && !editing) return;

        // Wrapper positioned over the video's rendered content box
        // (computed in layoutZones); SVG stretches percentages to fill it.
        const wrapper = document.createElement('div');
        wrapper.id = CONTAINER_ID;
        wrapper.style.cssText = 'position:absolute;pointer-events:none;z-index:2;';

        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.style.cssText = 'width:100%;height:100%;pointer-events:none;';

        // Labels are HTML, not SVG text: the SVG is stretched to the video
        // (preserveAspectRatio none), which would distort glyphs. HTML divs
        // at the polygon centroid stay undistorted and use the site's own
        // typography.
        const labelLayer = document.createElement('div');
        labelLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;';

        for (const zone of zones) {
            const pts = zone.points.filter(p => p?.length > 1 && !isNaN(p[0]) && !isNaN(p[1]));
            if (pts.length < 3) continue;

            const polygon = document.createElementNS(SVG_NS, 'polygon');
            polygon.setAttribute('points', pts.map(p => p.join(',')).join(' '));
            polygon.style.cssText = 'fill:transparent;stroke:transparent;stroke-width:0.5;transition:all 0.2s ease;';

            const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
            const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
            const label = document.createElement('div');
            label.className = 'text-light-text bg-dark rounded-md px-2 py-1 flex flex-col items-center gap-1';
            label.style.cssText = `position:absolute;left:${cx.toFixed(2)}%;top:${cy.toFixed(2)}%;`
                + 'transform:translate(-50%,-50%);opacity:0;transition:opacity 0.2s ease;';
            const name = document.createElement('div');
            name.className = 'text-lg font-bold leading-none whitespace-nowrap';
            name.textContent = formatRoomLabel(zone.target);
            const status = document.createElement('div');
            status.className = 'ftl-rerun-zone-status font-secondary uppercase tabular-nums text-light-text/50 text-xs leading-none whitespace-nowrap';
            status.dataset.room = zone.target;
            status.style.display = 'none';
            label.append(name, status);

            const group = document.createElementNS(SVG_NS, 'g');
            group.style.cssText = 'pointer-events:all;cursor:pointer;';
            if (editing) {
                // Edit mode: zones always visible. Deletion is handled by
                // the draw surface (it sits above this SVG), which hit-tests
                // clicks against zones before starting a trace.
                polygon.style.fill = zone.custom ? 'rgba(216,183,74,0.2)' : 'rgba(255,255,255,0.12)';
                polygon.style.stroke = zone.custom ? 'rgba(216,183,74,0.7)' : 'rgba(255,255,255,0.4)';
                label.style.opacity = '1';
                group.style.pointerEvents = 'none';
            } else {
                group.addEventListener('mouseenter', () => {
                    polygon.style.fill = 'rgba(216,183,74,0.12)';
                    polygon.style.stroke = 'rgba(216,183,74,0.5)';
                    label.style.opacity = '1';
                });
                group.addEventListener('mouseleave', () => {
                    polygon.style.fill = 'transparent';
                    polygon.style.stroke = 'transparent';
                    label.style.opacity = '0';
                });
                group.addEventListener('click', (e) => {
                    e.stopPropagation();
                    onNavigate?.(zone.target);
                });
            }
            group.append(polygon);
            svg.appendChild(group);
            labelLayer.appendChild(label);
        }

        wrapper.appendChild(svg);
        wrapper.appendChild(labelLayer);
        if (editing) buildDrawSurface(wrapper);
        playerEl$1.appendChild(wrapper);
        layoutZones();
        updateZoneStatuses();
    }

    /**
     * Refresh the status line under each zone label ("● On Air" or a No
     * Signal countdown, matching the grid tiles). Called by the host on
     * its 1s clock tick; no-ops when the host didn't supply a status
     * source (e.g. the site's own player).
     */
    function updateZoneStatuses() {
        if (!getRoomStatus || !playerEl$1) return;
        for (const el of playerEl$1.querySelectorAll('.ftl-rerun-zone-status')) {
            const text = getRoomStatus(el.dataset.room) || '';
            if (el.textContent !== text) el.textContent = text;
            el.style.display = text ? '' : 'none';
            el.classList.toggle('on-air', text.startsWith('●'));
        }
    }

    // ── Zone editor ─────────────────────────────────────────────────────
    // Trace-your-own zones: click points around a doorway, click the
    // first point again to close, pick the target room. Saved locally;
    // "Copy JSON" exports the season's zones (built-in + yours) so they
    // can be shared or baked into the extension as defaults.

    /**
     * ESC hook for the editor: cancels the in-progress trace first, then
     * exits edit mode. Returns true if the event was consumed.
     */
    function handleZonesEscape() {
        if (!editing) return false;
        if (draftPoints.length) {
            draftPoints = [];
            renderZones();
        } else {
            setZoneEditing(false);
        }
        return true;
    }

    function setZoneEditing(enable) {
        editing = enable;
        draftPoints = [];
        playerEl$1?.querySelector(`#${EDITOR_ID}`)?.remove();
        if (enable) buildEditorToolbar();
        renderZones();
    }

    function buildEditorToolbar() {
        const toolbar = document.createElement('div');
        toolbar.id = EDITOR_ID;
        toolbar.style.cssText = `
        position:absolute; top:12px; left:50%; transform:translateX(-50%);
        display:flex; align-items:center; gap:10px; z-index:5;
        background:rgba(0,0,0,0.75); border:1px solid rgba(255,255,255,0.2);
        border-radius:8px; padding:8px 12px; font-size:13px; color:#eee;
    `;
        const hint = document.createElement('span');
        hint.textContent = 'Trace a doorway: click points, click the first point to close. Click a zone to delete it. Esc cancels.';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'ftl-rerun-btn';
        copyBtn.textContent = 'Copy JSON';
        copyBtn.title = 'Copy this season\'s zones (defaults + yours) to the clipboard';
        copyBtn.addEventListener('click', () => copyZonesJson(copyBtn));

        const resetBtn = document.createElement('button');
        resetBtn.className = 'ftl-rerun-btn';
        resetBtn.textContent = 'Reset Room';
        resetBtn.title = 'Restore this room\'s default zones and delete your custom ones';
        resetBtn.addEventListener('click', () => {
            if (confirm(`Reset ${formatRoomLabel(currentRoom)} to its default zones? Your custom zones for this room will be deleted.`)) {
                resetRoomZones();
                renderZones();
            }
        });

        const doneBtn = document.createElement('button');
        doneBtn.className = 'ftl-rerun-btn';
        doneBtn.textContent = 'Done';
        doneBtn.addEventListener('click', () => setZoneEditing(false));

        toolbar.append(hint, copyBtn, resetBtn, doneBtn);
        playerEl$1.appendChild(toolbar);
    }

    function buildDrawSurface(wrapper) {
        const surface = document.createElement('div');
        surface.style.cssText = 'position:absolute;inset:0;cursor:crosshair;pointer-events:all;z-index:3;';

        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.style.cssText = 'width:100%;height:100%;pointer-events:none;';

        const draft = document.createElementNS(SVG_NS, 'polygon');
        draft.setAttribute('fill', 'rgba(0,255,0,0.1)');
        draft.setAttribute('stroke', '#0f0');
        draft.setAttribute('stroke-width', '0.4');

        const rubber = document.createElementNS(SVG_NS, 'line');
        rubber.setAttribute('stroke', '#0f0');
        rubber.setAttribute('stroke-dasharray', '1,1');
        rubber.setAttribute('stroke-width', '0.4');

        const startDot = document.createElementNS(SVG_NS, 'circle');
        startDot.setAttribute('r', '1.2');
        startDot.setAttribute('fill', '#0f0');
        startDot.setAttribute('stroke', '#000');
        startDot.setAttribute('stroke-width', '0.2');
        startDot.style.display = 'none';

        svg.append(draft, rubber, startDot);
        surface.appendChild(svg);

        const toPct = (e) => {
            const rect = surface.getBoundingClientRect();
            return [
                +((e.clientX - rect.left) / rect.width * 100).toFixed(3),
                +((e.clientY - rect.top) / rect.height * 100).toFixed(3),
            ];
        };

        surface.addEventListener('click', (e) => {
            e.stopPropagation();
            if (playerEl$1.querySelector('.ftl-rerun-zone-form')) return;
            const [x, y] = toPct(e);
            // Before starting a trace, a click inside an existing zone
            // offers deletion (the surface occludes the zone SVG). Custom
            // zones win the hit-test where they overlap a default; deleted
            // defaults are recorded as hidden so Reset Room can restore them.
            if (draftPoints.length === 0) {
                const zones = getZonesForRoom(currentRoom);
                const hit = zones.filter(z => z.custom).find(z => pointInPolygon([x, y], z.points))
                    || zones.find(z => pointInPolygon([x, y], z.points));
                if (hit) {
                    const label = formatRoomLabel(hit.target);
                    if (hit.custom) {
                        if (confirm(`Delete your zone to ${label}?`)) {
                            deleteCustomZone(hit);
                            renderZones();
                        }
                    } else if (confirm(`Remove the default zone to ${label}? Reset Room brings the defaults back.`)) {
                        hideBuiltInZone(hit);
                        renderZones();
                    }
                    return;
                }
            }
            if (draftPoints.length > 2
                && Math.hypot(x - draftPoints[0][0], y - draftPoints[0][1]) < 3) {
                showTargetForm([...draftPoints]);
                return;
            }
            draftPoints.push([x, y]);
            draft.setAttribute('points', draftPoints.map(p => p.join(',')).join(' '));
            if (draftPoints.length === 1) {
                startDot.setAttribute('cx', x);
                startDot.setAttribute('cy', y);
                startDot.style.display = 'block';
            }
        });

        surface.addEventListener('mousemove', (e) => {
            if (!draftPoints.length) return;
            const [x, y] = toPct(e);
            const last = draftPoints[draftPoints.length - 1];
            rubber.setAttribute('x1', last[0]);
            rubber.setAttribute('y1', last[1]);
            const closing = draftPoints.length > 2
                && Math.hypot(x - draftPoints[0][0], y - draftPoints[0][1]) < 3;
            rubber.setAttribute('x2', closing ? draftPoints[0][0] : x);
            rubber.setAttribute('y2', closing ? draftPoints[0][1] : y);
            startDot.setAttribute('fill', closing ? '#ff0' : '#0f0');
            startDot.setAttribute('r', closing ? '2' : '1.2');
        });

        surface.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            handleZonesEscape();
        });

        wrapper.appendChild(surface);
    }

    function showTargetForm(points) {
        const form = document.createElement('div');
        form.className = 'ftl-rerun-zone-form';
        form.style.cssText = `
        position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
        display:flex; flex-direction:column; gap:10px; z-index:6; width:260px;
        background:rgba(15,15,15,0.95); border:1px solid rgba(255,255,255,0.2);
        border-radius:8px; padding:14px; font-size:13px; color:#eee;
    `;
        const title = document.createElement('div');
        title.style.fontWeight = 'bold';
        title.textContent = 'Where does this doorway lead?';

        const select = document.createElement('select');
        select.style.cssText = 'padding:6px;background:#222;color:#eee;border:1px solid #555;border-radius:6px;';
        for (const room of getRooms()) {
            if (room === currentRoom) continue;
            const opt = document.createElement('option');
            opt.value = room;
            opt.textContent = formatRoomLabel(room);
            select.appendChild(opt);
        }

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'ftl-rerun-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => {
            form.remove();
            draftPoints = [];
            renderZones();
        });
        const saveBtn = document.createElement('button');
        saveBtn.className = 'ftl-rerun-btn';
        saveBtn.textContent = 'Save Zone';
        saveBtn.addEventListener('click', () => {
            saveCustomZone(points, select.value);
            form.remove();
            draftPoints = [];
            renderZones();
        });
        row.append(cancelBtn, saveBtn);

        form.append(title, select, row);
        playerEl$1.appendChild(form);
    }

    /**
     * Ray-casting point-in-polygon test ([x, y] against [[x, y], ...]).
     */
    function pointInPolygon(point, polygon) {
        const [x, y] = point;
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const [xi, yi] = polygon[i];
            const [xj, yj] = polygon[j];
            if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
                inside = !inside;
            }
        }
        return inside;
    }

    // ── Custom zone storage ─────────────────────────────────────────────

    function saveCustomZone(points, target) {
        const season = getSeason();
        const custom = getCustomZones();
        custom[season] = custom[season] || {};
        custom[season][currentRoom] = custom[season][currentRoom] || [];
        custom[season][currentRoom].push({ points, target });
        set(CUSTOM_ZONES_KEY, custom);
    }

    function deleteCustomZone(zone) {
        const season = getSeason();
        const custom = getCustomZones();
        const list = custom[season]?.[currentRoom];
        if (!list) return;
        const key = zoneKey(zone);
        custom[season][currentRoom] = list.filter(z => zoneKey(z) !== key);
        set(CUSTOM_ZONES_KEY, custom);
    }

    function hideBuiltInZone(zone) {
        const season = getSeason();
        const hidden = getHiddenZones();
        hidden[season] = hidden[season] || {};
        hidden[season][currentRoom] = hidden[season][currentRoom] || [];
        hidden[season][currentRoom].push(zoneKey(zone));
        set(HIDDEN_ZONES_KEY, hidden);
    }

    /**
     * Restore the current room to its built-in zones: un-hides deleted
     * defaults and removes the user's custom zones for the room.
     */
    function resetRoomZones() {
        const season = getSeason();
        const hidden = getHiddenZones();
        if (hidden[season]?.[currentRoom]) {
            delete hidden[season][currentRoom];
            set(HIDDEN_ZONES_KEY, hidden);
        }
        const custom = getCustomZones();
        if (custom[season]?.[currentRoom]) {
            delete custom[season][currentRoom];
            set(CUSTOM_ZONES_KEY, custom);
        }
    }

    function copyZonesJson(button) {
        const season = getSeason();
        const merged = {};
        const builtIn = SEASON_ZONES[season] || {};
        const custom = getCustomZones()[season] || {};
        const hidden = getHiddenZones()[season] || {};
        for (const room of new Set([...Object.keys(builtIn), ...Object.keys(custom)])) {
            const hiddenSet = new Set(hidden[room] || []);
            merged[room] = [
                ...(builtIn[room] || []).filter(z => !hiddenSet.has(zoneKey(z)))
                    .map(z => ({ points: z.points, target: z.target })),
                ...(custom[room] || []).map(z => ({ points: z.points, target: z.target })),
            ];
        }
        const json = JSON.stringify(merged, null, 2);
        navigator.clipboard.writeText(json).then(() => {
            button.textContent = 'Copied!';
            setTimeout(() => { button.textContent = 'Copy JSON'; }, 2000);
        }).catch(() => {
            prompt('Copy the zones JSON below:', json);
        });
    }

    /**
     * Size the wrapper to the video's rendered content box, accounting
     * for object-fit: contain letterboxing.
     */
    function layoutZones() {
        if (!playerEl$1) return;
        const wrapper = playerEl$1.querySelector(`#${CONTAINER_ID}`);
        if (!wrapper) return;
        // Layout metrics, NOT getBoundingClientRect(): the site animates
        // its focused player with a transform scale, so a mid-animation
        // rect would bake the scaled size in permanently (ResizeObserver
        // doesn't fire on transforms). Client sizes are transform-proof.
        const boxW = playerEl$1.clientWidth;
        const boxH = playerEl$1.clientHeight;
        if (!boxW || !boxH) return;
        const boxAspect = boxW / boxH;
        // No video loaded (No Signal) → assume the archive's 16:9 frame so
        // zones still sit where the picture would be and remain clickable.
        const vidAspect = (videoEl$1?.videoWidth && videoEl$1?.videoHeight)
            ? videoEl$1.videoWidth / videoEl$1.videoHeight
            : 16 / 9;
        const width = boxAspect > vidAspect ? boxH * vidAspect : boxW;
        const height = boxAspect > vidAspect ? boxH : boxW / vidAspect;
        Object.assign(wrapper.style, {
            width: `${width}px`,
            height: `${height}px`,
            left: `${(boxW - width) / 2}px`,
            top: `${(boxH - height) / 2}px`,
        });
    }

    /**
     * rerun-ui.js — Re-run mode: grid + player UI
     *
     * Renders the personal re-run experience: a full-area overlay with a
     * clickable grid of room tiles (with No Signal countdowns), and a
     * focused player that replaces the grid when a room is clicked —
     * mirroring how the site's own archive-live grid behaves.
     *
     * The overlay is docked inside the site's page wrapper, absolutely
     * positioned over the stream grid's box only — header, chat, tickers
     * and modals all keep their normal place and stacking. If the grid
     * container can't be found, it falls back to a fixed full-viewport
     * overlay that stops at the chat's left edge (legacy behaviour).
     *
     * All state/data comes from rerun.js; this module is DOM only.
     *
     * PLAYBACK ENGINE (focused room):
     * - Resolve chunk + offset for virtualNow(), fetch signed URL, play
     * - Validate offset against real duration (gap → No Signal + countdown)
     * - Drift resync (>2s) on a 30s check and on visibilitychange
     * - onEnded/countdown-expiry → re-resolve; next chunk URL prefetched
     *   ~45s before the current chunk ends for a near-gapless handover
     * - onError → re-request signed URL (expired token), then back off
     */


    const OVERLAY_ID = 'ftl-rerun-overlay';
    const STYLE_ID = 'ftl-rerun-styles';
    const VOLUME_KEY = 'rerun-volume';

    const DRIFT_TOLERANCE_S = 2;
    const SYNC_CHECK_MS = 30000;
    const TILE_REFRESH_MS = 30000;
    const PREFETCH_LEAD_S = 45;

    // ── State ───────────────────────────────────────────────────────────

    let overlay = null;
    let gridEl = null;
    let playerEl = null;
    let videoEl = null;
    let clockEls = [];          // elements showing "Day N  HH:MM:SS"
    let playerClockDay = null;  // player clock "Day N" span
    let playerClockTime = null; // player clock "HH:MM:SS" span
    let focusedRoom = null;
    let currentChunk = null;    // chunk object currently loaded in the video
    let endedChunk = null;      // { fileName, duration } — real footage exhausted
    let prefetched = null;      // { fileName, url }
    let tileStates = new Map(); // room → { status, nextStartsAtMs }
    let intervals = [];
    let resyncTimeout = null;
    let errorRetries = 0;
    let savedChatZ = null;
    let dockedGrid = null;      // the site grid element we're docked over
    let dockResize = null;      // ResizeObserver tracking the site grid's box

    // ── Styles ──────────────────────────────────────────────────────────

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
        #${OVERLAY_ID} {
            position: absolute;
            /* colour + texture come from the site's own bg-background
               classes (added on the element); fixed attachment keeps
               the texture tiles aligned with the page's fixed layer */
            background-attachment: fixed;
            z-index: 4;
            display: flex;
            flex-direction: column;
            font-family: inherit;
            color: #eee;
            border-radius: 6px;
        }
        #${OVERLAY_ID}.ftl-rerun-fixed {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            z-index: 50;
            border-radius: 0;
        }
        #${OVERLAY_ID} .ftl-rerun-header {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 10px 16px;
            flex: 0 0 auto;
            border-radius: 6px 6px 0 0;
        }
        #${OVERLAY_ID} .ftl-rerun-title {
            font-weight: bold;
            font-size: 15px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        #${OVERLAY_ID} .ftl-rerun-clock {
            font-variant-numeric: tabular-nums;
            font-size: 14px;
        }
        #${OVERLAY_ID} .ftl-rerun-paused-badge {
            font-size: 11px;
            text-transform: uppercase;
            border: 1px solid currentColor;
            border-radius: 4px;
            padding: 2px 6px;
            display: none;
        }
        #${OVERLAY_ID}.ftl-rerun-is-paused .ftl-rerun-paused-badge { display: inline-block; }
        #${OVERLAY_ID} .ftl-rerun-spacer { flex: 1; }
        #${OVERLAY_ID} .ftl-rerun-nudges { display: flex; gap: 4px; }
        #${OVERLAY_ID} .ftl-rerun-shared-badge {
            font-size: 11px;
            text-transform: uppercase;
            border: 1px solid currentColor;
            border-radius: 4px;
            padding: 2px 6px;
            white-space: nowrap;
        }
        #${OVERLAY_ID} .ftl-rerun-btn {
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 6px;
            color: rgba(255,255,255,0.85);
            cursor: pointer;
            padding: 6px 12px;
            font-size: 13px;
            line-height: 1;
            transition: background 0.15s;
        }
        #${OVERLAY_ID} .ftl-rerun-btn:hover { background: rgba(255,255,255,0.18); color: #fff; }
        /* Grid layout mirrors the site's stream grid: 2 cols (gap-5),
           6 cols + gap-10 at lg, rows squeezed to fit in desktop
           landscape. Tile visuals use the site's own utility classes. */
        #${OVERLAY_ID} .ftl-rerun-grid {
            flex: 1;
            min-height: 0;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 20px;
            overflow-y: auto;
            align-content: start;
            padding: 8px;
            margin: -8px;   /* room for tile hover outlines at the edges */
        }
        #${OVERLAY_ID} .ftl-rerun-cell {
            position: relative;
            aspect-ratio: 3 / 2;
        }
        @media (min-width: 1024px) {
            #${OVERLAY_ID} .ftl-rerun-grid {
                grid-template-columns: repeat(var(--ftl-rerun-cols, 6), minmax(0, 1fr));
                gap: 40px;
            }
        }
        @media (min-width: 1024px) and (orientation: landscape) {
            #${OVERLAY_ID} .ftl-rerun-grid {
                grid-template-rows: repeat(var(--ftl-rerun-rows, 4), minmax(0, 1fr));
                align-content: stretch;
            }
            #${OVERLAY_ID} .ftl-rerun-cell { aspect-ratio: auto; }
        }
        #${OVERLAY_ID} .ftl-rerun-tile-status.on-air { color: #4ade80; }
        #${OVERLAY_ID} .ftl-rerun-zone-status.on-air { color: #4ade80; }
        #${OVERLAY_ID} .ftl-rerun-tile.ftl-rerun-on-air .ftl-rerun-tile-noise { display: none; }
        /* Live thumbnail: shown once loaded; hides the centred status */
        #${OVERLAY_ID} .ftl-rerun-tile-thumb { display: none; }
        #${OVERLAY_ID} .ftl-rerun-tile.ftl-rerun-has-thumb .ftl-rerun-tile-thumb { display: block; }
        #${OVERLAY_ID} .ftl-rerun-tile.ftl-rerun-has-thumb .ftl-rerun-tile-center { display: none; }
        #${OVERLAY_ID} .ftl-rerun-player {
            position: relative;
            flex: 1;
            display: none;
            background: #000;
            overflow: hidden;
            border-radius: 0 0 6px 6px;
        }
        #${OVERLAY_ID}.ftl-rerun-focused .ftl-rerun-grid { display: none; }
        #${OVERLAY_ID}.ftl-rerun-focused .ftl-rerun-player { display: block; }
        /* Controls fade out while idle (see buildPlayer's idle timer) */
        #${OVERLAY_ID} .ftl-rerun-player-bar,
        #${OVERLAY_ID} .ftl-rerun-player-clock,
        #${OVERLAY_ID} .ftl-rerun-close-btn { transition: opacity 0.3s ease; }
        #${OVERLAY_ID} .ftl-rerun-player.ftl-rerun-idle .ftl-rerun-player-bar,
        #${OVERLAY_ID} .ftl-rerun-player.ftl-rerun-idle .ftl-rerun-player-clock,
        #${OVERLAY_ID} .ftl-rerun-player.ftl-rerun-idle .ftl-rerun-close-btn {
            opacity: 0;
            pointer-events: none;
        }
        #${OVERLAY_ID} .ftl-rerun-player.ftl-rerun-idle { cursor: none; }
        /* ── Mobile (below the site's lg breakpoint) ─────────────────
           The site's chat becomes a fixed bottom panel (z-2 inside a
           z-1 wrapper) overlaying the page. Drop the overlay beneath it
           — DOM order still paints us above the grid tiles we cover —
           and pin the focused player to the top 55% of the viewport,
           exactly like the site's own mobile camera player. */
        @media (max-width: 1023px) {
            #${OVERLAY_ID}:not(.ftl-rerun-fixed) { z-index: 0; }
            #${OVERLAY_ID}.ftl-rerun-focused .ftl-rerun-player {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: calc(var(--vh, 1vh) * 55);
                border-radius: 0;
            }
        }
        #${OVERLAY_ID} .ftl-rerun-player video {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        #${OVERLAY_ID} .ftl-rerun-room-label {
            position: absolute;
            top: 0;
            left: 0;
            margin: 12px;
            font-size: 18px;
            font-weight: bold;
            color: #fff;
            text-shadow: 2px 2px 0 rgba(0,0,0,0.5);
            z-index: 3;
        }
        /* Focused player controls mimic the site's player: X top-right,
           volume bottom-left, Day+clock bottom-right. Our header only
           shows on the grid view. */
        #${OVERLAY_ID}.ftl-rerun-focused .ftl-rerun-header { display: none; }
        #${OVERLAY_ID} .ftl-rerun-player-bar {
            position: absolute;
            bottom: 0;
            left: 0;
            display: flex;
            align-items: center;
            gap: 10px;
            margin: 12px;
            z-index: 3;
        }
        #${OVERLAY_ID} .ftl-rerun-player-clock {
            position: absolute;
            bottom: 0;
            right: 0;
            margin: 14px 12px;
            z-index: 3;
        }
        #${OVERLAY_ID} .ftl-rerun-volume-btn {
            background: none;
            border: none;
            padding: 0;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
        }
        #${OVERLAY_ID} .ftl-rerun-nosignal {
            position: absolute;
            inset: 0;
            z-index: 2;
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 8px;
            background:
                repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 3px),
                #101010;
        }
        #${OVERLAY_ID} .ftl-rerun-nosignal.visible { display: flex; }
        #${OVERLAY_ID} .ftl-rerun-nosignal-label {
            font-size: 22px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            color: rgba(255,255,255,0.8);
            text-shadow: 2px 2px 0 rgba(0,0,0,0.6);
        }
        #${OVERLAY_ID} .ftl-rerun-nosignal-countdown {
            font-size: 15px;
            color: rgba(255,255,255,0.45);
            font-variant-numeric: tabular-nums;
            text-transform: uppercase;
        }
        #${OVERLAY_ID} .ftl-rerun-message {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 40px;
            color: rgba(255,255,255,0.7);
            font-size: 15px;
            line-height: 1.5;
        }
        /* Fixed fallback only: keep site modals above the overlay */
        body.ftl-rerun-fixed-open #modal { z-index: 52 !important; }
    `;
        document.head.appendChild(style);
    }

    // ── Mounting ────────────────────────────────────────────────────────
    //
    // Preferred: dock inside the home page wrapper (div.pb-10 > div.relative,
    // the same persistent anchor archive-grid.js uses), absolutely positioned
    // over the stream grid element. The grid's own responsive margins already
    // keep it clear of the chat panel, so no z-index juggling is needed.
    // Fallback: fixed full-viewport overlay with the chat raised above it.

    function findSiteGrid() {
        const outer = document.querySelector('div.pb-10');
        if (!outer) return null;
        // Layout drift: originally the grid was nested as pb-10 > div.relative
        // > div.grid; the Aug 2026 site update dropped the div.relative and
        // puts div.grid directly under pb-10. Support both.
        const inner = [...outer.children].find(el => el.classList.contains('relative'));
        const wrapper = inner || outer;
        const grid = [...wrapper.children].find(el => el.classList.contains('grid'));
        return grid ? { wrapper, grid } : null;
    }

    function positionOverlay() {
        if (!overlay || !dockedGrid) return;
        // A site re-render (e.g. clicking the logo re-routes to home) can
        // replace the grid while keeping the wrapper — and our observers
        // fire as the old grid collapses. Never measure a dead grid: keep
        // the last good geometry until ensureMounted re-docks to the new one.
        if (!dockedGrid.isConnected) return;
        // Theatre mode owns the overlay's geometry while active.
        if (document.body.classList.contains('ftl-theatre-mode')) return;
        // Cover the grid's CONTENT box, not its border box — the site grid's
        // horizontal padding (pl-5 / lg:pr-10) extends under the chat panel's
        // margin, and painting over it would clip the chat's edge.
        const cs = getComputedStyle(dockedGrid);
        const padL = parseFloat(cs.paddingLeft) || 0;
        const padR = parseFloat(cs.paddingRight) || 0;
        overlay.style.top = `${dockedGrid.offsetTop}px`;
        overlay.style.left = `${dockedGrid.offsetLeft + padL}px`;
        overlay.style.width = `${dockedGrid.clientWidth - padL - padR}px`;
        // On mobile the site's chat is a fixed panel covering the bottom
        // ~40vh (+48px nav). The site's own grid hides its last rows under
        // it; we do better by extending the overlay with empty clearance so
        // every row can scroll up past the chat. Our header makes our grid
        // run taller than the site's, so measure clearance from our own
        // last tile rather than the site grid's bottom.
        let height = dockedGrid.offsetHeight;
        if (window.matchMedia('(max-width: 1023px)').matches) {
            const cells = overlay.querySelectorAll('.ftl-rerun-cell');
            const last = cells[cells.length - 1];
            const contentBottom = last ? last.offsetTop + last.offsetHeight : height;
            height = Math.max(height, contentBottom)
                + Math.round(window.innerHeight * 0.4) + 64;
        }
        overlay.style.height = `${height}px`;
    }

    function mountDocked() {
        const found = findSiteGrid();
        if (!found) return false;
        dockedGrid = found.grid;
        // The old div.relative wrapper was a positioned ancestor; the new
        // bare pb-10 wrapper isn't. Make it one so the overlay's absolute
        // coordinates match the grid's offsets (position:relative with no
        // offsets doesn't move anything).
        if (getComputedStyle(found.wrapper).position === 'static') {
            found.wrapper.style.position = 'relative';
        }
        overlay.style.right = '';
        found.wrapper.appendChild(overlay);
        positionOverlay();
        dockResize = new ResizeObserver(positionOverlay);
        dockResize.observe(dockedGrid);
        window.addEventListener('resize', positionOverlay);
        return true;
    }

    function mountFixed() {
        overlay.classList.add('ftl-rerun-fixed');
        overlay.style.top = overlay.style.left = overlay.style.width = overlay.style.height = '';
        document.body.classList.add('ftl-rerun-fixed-open');
        document.body.appendChild(overlay);
        layoutAroundChat();
        window.addEventListener('resize', layoutAroundChat);
    }

    function unmountListeners() {
        dockResize?.disconnect();
        dockResize = null;
        dockedGrid = null;
        window.removeEventListener('resize', positionOverlay);
        window.removeEventListener('resize', layoutAroundChat);
    }

    /**
     * Called on the 1s tick: re-dock if a site re-render detached us, or
     * upgrade from the fixed fallback once the grid container appears.
     */
    function ensureMounted() {
        if (!overlay) return;
        const fixedMode = overlay.classList.contains('ftl-rerun-fixed');
        // Docked is only healthy while the grid we measure against is
        // still mounted — the overlay itself can survive a re-render that
        // swaps the grid out from under it.
        if (overlay.isConnected && !fixedMode && dockedGrid?.isConnected) return;
        if (overlay.isConnected && fixedMode && !findSiteGrid()) return;
        unmountListeners();
        restoreChatZ();
        overlay.classList.remove('ftl-rerun-fixed');
        document.body.classList.remove('ftl-rerun-fixed-open');
        if (!mountDocked()) mountFixed();
    }

    // ── Chat panel coexistence (fixed fallback only) ────────────────────

    function findChatContainer() {
        const chatInput = document.getElementById('chat-input');
        if (!chatInput) return null;
        let el = chatInput.parentElement;
        while (el && el !== document.body) {
            if (el.classList.contains('fixed') || el.style.position === 'fixed') return el;
            el = el.parentElement;
        }
        return null;
    }

    /**
     * Size the overlay to stop at the chat panel's left edge (or span the
     * full viewport when no chat is present), and raise the chat above it.
     */
    function layoutAroundChat() {
        if (!overlay) return;
        const chat = findChatContainer();
        if (chat) {
            const rect = chat.getBoundingClientRect();
            const chatWidth = Math.max(0, window.innerWidth - rect.left);
            overlay.style.right = (rect.width > 40 && chatWidth < window.innerWidth / 2)
                ? `${chatWidth}px`
                : '0';
            if (savedChatZ === null) {
                savedChatZ = { el: chat, z: chat.style.zIndex, parentZ: chat.parentElement?.style.zIndex ?? '' };
                chat.style.zIndex = '51';
                if (chat.parentElement) chat.parentElement.style.zIndex = '51';
            }
        } else {
            overlay.style.right = '0';
        }
    }

    function restoreChatZ() {
        if (savedChatZ) {
            savedChatZ.el.style.zIndex = savedChatZ.z;
            if (savedChatZ.el.parentElement) savedChatZ.el.parentElement.style.zIndex = savedChatZ.parentZ;
            savedChatZ = null;
        }
    }

    // ── Formatting ──────────────────────────────────────────────────────

    function formatCountdown(ms) {
        const total = Math.max(0, Math.ceil(ms / 1000));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        return h > 0
            ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
            : `${m}:${String(s).padStart(2, '0')}`;
    }

    function clockText() {
        const now = virtualNow();
        if (now == null) return '';
        const day = virtualMsToDayNumber(now);
        return `${day != null ? `Day ${day}` : ''}  ${formatClock(now)}`;
    }

    // ── Overlay lifecycle ───────────────────────────────────────────────

    /**
     * Room code the player is currently focused on, or null when the
     * player is closed or showing the grid (used by the sidebar panel's
     * Share button so its links carry the room being watched).
     */
    function getFocusedRoom() {
        return focusedRoom;
    }

    /**
     * ESC handling hook for index.js: focused → back to grid; grid → close.
     * Returns true if the event was consumed.
     */
    function handleRerunEscape() {
        if (!overlay) return false;
        if (document.fullscreenElement) return false; // browser handles fullscreen exit
        if (handleZonesEscape()) return true; // cancel trace / exit zone editor first
        if (focusedRoom) {
            exitFocused();
        } else {
            closeRerunOverlay();
        }
        return true;
    }

    /**
     * Open a share code (or share link) as a PREVIEW: the re-run plays
     * from the shared moment while the user's own anchor stays untouched.
     * Returns '' on success, or a human-readable error message.
     */
    async function watchShareCode(input) {
        const code = parseShareCode(input);
        if (!code) return 'That doesn\'t look like a valid share code.';

        if (code.season !== getSetting('rerunSeason')) {
            // v1: previews can't span seasons (season data is a singleton),
            // so a cross-season code means switching outright.
            const hasOwn = getSetting('rerunAnchorVirtual') != null;
            if (hasOwn && !confirm(
                `This share code is for season ${code.season.replace(/^s0?/, '')}, but your re-run is in another season. `
                + 'Watching it will end your current re-run. Continue?')) {
                return '';
            }
            changeSeason(code.season);
        }

        const ok = await loadSeasonData();
        if (!ok) return 'Couldn\'t load archive data — are you logged in with a season pass?';
        const ms = dayTimeToVirtualMs(code.day, code.time);
        if (ms == null) return `That season doesn't have a Day ${code.day}.`;
        if (code.room && !getSeasonRooms().includes(code.room)) {
            return `Unknown room "${code.room}" in that season.`;
        }

        closeRerunOverlay(); // rebuild fresh (also discards any older preview)
        // Always a temporary layer — opening a link never writes anything;
        // an existing re-run stays untouched underneath.
        startPreview(ms);
        await openRerunOverlay();
        if (code.room && playerEl) focusRoom(code.room);
        return '';
    }

    async function openRerunOverlay() {
        if (overlay) return;
        injectStyles();

        overlay = document.createElement('div');
        overlay.id = OVERLAY_ID;
        overlay.setAttribute('data-ftl-sdk', 'rerun');
        // Match the page background exactly: the site paints it on a fixed
        // layer behind everything (bg-background colour + texture image),
        // so the overlay borrows the same classes rather than a colour.
        overlay.classList.add('bg-background', '[background-image:var(--texture-background)]');
        document.body.classList.add('ftl-rerun-open');
        if (!mountDocked()) mountFixed();

        buildHeader();
        intervals.push(setInterval(renderClocks, 1000));

        const ok = await loadSeasonData();
        if (!overlay) return; // closed while loading
        if (!ok) {
            showMessage('Couldn\'t load archive data. Watching the archives requires being logged in to fishtank.live with a season pass — check that, then try again.');
            return;
        }
        if (virtualNow() == null) {
            showMessage('No re-run start point set. Open FTL Extended settings (E) → Re-run tab and pick a day and time.');
            return;
        }
        if (isPastSeasonEnd()) {
            showMessage('Your re-run has reached the end of the season. Pick a new start point in the Re-run settings tab.');
            return;
        }

        buildGrid();
        buildPlayer();
        refreshTiles();

        intervals.push(setInterval(refreshTiles, TILE_REFRESH_MS));
        intervals.push(setInterval(() => { if (focusedRoom) syncPlayback(false); }, SYNC_CHECK_MS));
        document.addEventListener('visibilitychange', onVisibilityChange);
        document.addEventListener('keydown', onPlayerKeys);
    }

    function closeRerunOverlay() {
        if (!overlay) return;
        exitFocused();
        endPreview(); // previews never outlive the overlay
        intervals.forEach(clearInterval);
        intervals = [];
        if (resyncTimeout) { clearTimeout(resyncTimeout); resyncTimeout = null; }
        unmountListeners();
        document.removeEventListener('visibilitychange', onVisibilityChange);
        document.removeEventListener('keydown', onPlayerKeys);
        restoreChatZ();
        document.body.classList.remove('ftl-rerun-open');
        document.body.classList.remove('ftl-rerun-fixed-open');
        overlay.remove();
        overlay = null;
        gridEl = null;
        playerEl = null;
        videoEl = null;
        clockEls = [];
        playerClockDay = null;
        playerClockTime = null;
        tileStates = new Map();
    }

    function onVisibilityChange() {
        if (document.visibilityState === 'visible' && focusedRoom) syncPlayback(false);
    }

    function showMessage(text) {
        if (!overlay) return;
        overlay.querySelector('.ftl-rerun-message')?.remove();
        const msg = document.createElement('div');
        msg.className = 'ftl-rerun-message';
        msg.textContent = text;
        overlay.appendChild(msg);
    }

    // ── Header ──────────────────────────────────────────────────────────

    function buildHeader() {
        // Styled as one of the site's light textured panels (same treatment
        // as the chat box / ticker frames), so it stands out against the
        // dark grid the way the site's own bars do.
        const header = document.createElement('div');
        header.className = 'ftl-rerun-header bg-light text-dark-text [background-image:var(--texture-panel)]'
            + ' border-t-2 border-t-light-300/75 border-b-3 border-b-light-700/50'
            + ' border-l-2 border-l-light-300/75 border-r-2 border-r-light-700/75 shadow-panel';

        const title = document.createElement('span');
        title.className = 'ftl-rerun-title';
        const season = getSetting('rerunSeason');
        title.textContent = `Re-run — Season ${parseInt(String(season).replace(/^s/, ''), 10) || ''}`;

        const clock = document.createElement('span');
        clock.className = 'ftl-rerun-clock text-dark-text-400';
        clockEls.push(clock);

        const nudges = makeNudgeButtons();

        const pausedBadge = document.createElement('span');
        pausedBadge.className = 'ftl-rerun-paused-badge text-primary-400';
        pausedBadge.textContent = 'Paused';

        const spacer = document.createElement('div');
        spacer.className = 'ftl-rerun-spacer';

        const pauseBtn = makePauseButton();

        const closeBtn = siteTextButton(
            'Close re-run and return to the live site',
            'Exit Re-run',
            closeRerunOverlay,
            'primary'
        );

        header.append(title, clock);
        if (isPreviewActive()) {
            const sharedBadge = document.createElement('span');
            sharedBadge.className = 'ftl-rerun-shared-badge text-primary-400';
            sharedBadge.textContent = 'Shared Moment';
            header.appendChild(sharedBadge);
        }
        header.append(nudges, pausedBadge, spacer);
        if (isPreviewActive()) header.appendChild(makePreviewControls());
        header.append(pauseBtn, closeBtn);
        overlay.appendChild(header);
        overlay.classList.toggle('ftl-rerun-is-paused', isPaused());
        renderClocks();
    }

    /**
     * The single way out of a shared moment: exit it and land back on your
     * own re-run, which stayed untouched (and kept running) underneath.
     * One instance lives in the header, one in the auto-hiding player bar.
     */
    function makePreviewControls() {
        return siteTextButton(
            'Stop watching this shared moment and return to your own re-run',
            'Exit Shared Moment',
            () => {
                const hasOwn = getSetting('rerunAnchorVirtual') != null;
                endPreview();
                closeRerunOverlay();
                if (hasOwn) openRerunOverlay();
            },
            'primary'
        );
    }

    // Site react-icons path (IoClose), matching the site player's X button.
    const CLOSE_ICON_SVG = '<svg viewBox="0 0 512 512" fill="currentColor" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M400 145.49 366.51 112 256 222.51 145.49 112 112 145.49 222.51 256 112 366.51 145.49 400 256 289.49 366.51 400 400 366.51 289.49 256 400 145.49z"></path></svg>';

    // Site react-icons paths (IoPause / IoPlay), matching the player buttons.
    const PAUSE_ICON_SVG = '<svg viewBox="0 0 512 512" fill="currentColor" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M208 432h-48a16 16 0 0 1-16-16V96a16 16 0 0 1 16-16h48a16 16 0 0 1 16 16v320a16 16 0 0 1-16 16zm144 0h-48a16 16 0 0 1-16-16V96a16 16 0 0 1 16-16h48a16 16 0 0 1 16 16v320a16 16 0 0 1-16 16z"></path></svg>';
    const PLAY_ICON_SVG = '<svg viewBox="0 0 512 512" fill="currentColor" width="20" height="20" xmlns="http://www.w3.org/2000/svg"><path d="M133 440a35.37 35.37 0 0 1-17.5-4.67c-12-6.8-19.46-20-19.46-34.33V111c0-14.37 7.46-27.53 19.46-34.33a35.13 35.13 0 0 1 35.77.45l247.85 148.36a36 36 0 0 1 0 61l-247.89 148.4A35.5 35.5 0 0 1 133 440z"></path></svg>';

    function makePauseButton() {
        const btn = siteIconButton(
            isPaused() ? 'Resume re-run clock' : 'Pause re-run clock',
            isPaused() ? PLAY_ICON_SVG : PAUSE_ICON_SVG,
            togglePause,
        );
        btn.classList.add('ftl-rerun-pause-btn');
        return btn;
    }

    /**
     * Time nudge buttons — jump the re-run clock without re-picking a
     * start point. Ordered as a number line: back on the left. Used in
     * both the header bar and the focused player's control bar.
     */
    function makeNudgeButtons() {
        const nudges = document.createElement('div');
        nudges.className = 'ftl-rerun-nudges';
        for (const [label, ms] of [
            ['-1h', -36e5], ['-5m', -3e5], ['-1m', -6e4],
            ['+1m', 60000], ['+5m', 300000], ['+1h', 3600000],
        ]) {
            const back = ms < 0;
            nudges.appendChild(siteTextButton(
                `Jump ${back ? 'back' : 'forward'} ${label.slice(1)}`,
                label,
                () => nudgeClock(ms),
                back ? 'primary' : 'secondary'
            ));
        }
        return nudges;
    }

    /**
     * Player keys, matching video-player convention: ←/→ = ±5s,
     * Space = pause/resume. Works in fullscreen and theatre with zero
     * on-screen chrome. Bigger jumps live on the nudge buttons.
     */
    function onPlayerKeys(e) {
        if (!overlay) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (e.key === ' ') {
            e.preventDefault();
            togglePause();
            return;
        }
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        nudgeClock(e.key === 'ArrowRight' ? 5000 : -5e3);
    }

    function nudgeClock(deltaMs) {
        nudge(deltaMs);
        renderClocks();
        refreshTiles();
        // syncPlayback no-ops while paused (frame stays frozen); the nudged
        // moment takes effect on resume, which re-anchors and syncs.
        if (focusedRoom) syncPlayback(true);
    }

    function togglePause() {
        if (isPaused()) {
            resume();
            if (focusedRoom) syncPlayback(true);
        } else {
            pause();
            videoEl?.pause();
        }
        updatePauseUi();
    }

    function updatePauseUi() {
        if (!overlay) return;
        const paused = isPaused();
        overlay.querySelectorAll('.ftl-rerun-pause-btn').forEach(b => {
            const inner = b.firstElementChild;
            if (inner) inner.innerHTML = paused ? PLAY_ICON_SVG : PAUSE_ICON_SVG;
            b.title = paused ? 'Resume re-run clock' : 'Pause re-run clock';
        });
        overlay.classList.toggle('ftl-rerun-is-paused', paused);
    }

    function renderClocks() {
        ensureMounted();
        const text = clockText();
        for (const el of clockEls) el.textContent = text;
        if (playerClockDay) {
            const now = virtualNow();
            if (now != null) {
                const day = virtualMsToDayNumber(now);
                playerClockDay.textContent = day != null ? `Day ${day}` : '';
                playerClockTime.textContent = formatClock(now);
            }
        }
        renderTileCountdowns();
        renderPlayerCountdown();
        updateZoneStatuses();
    }

    // ── Grid ────────────────────────────────────────────────────────────

    // Same static-noise SVG the site's archive tiles use.
    const NOISE_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='128' height='128' filter='url(%23n)'/%3E%3C/svg%3E`;

    function buildGrid() {
        gridEl = document.createElement('div');
        gridEl.className = 'ftl-rerun-grid';
        const rooms = getSeasonRooms();

        // Mirror the site's archive grid sizing: 6 desktop columns for big
        // seasons, 4 for small ones; pad the last row with empty tiles and
        // squeeze rows (max 6) so cells stay close to square.
        const total = rooms.length;
        const cols = total > 16 ? 6 : 4;
        const fillers = (cols - (total % cols)) % cols;
        const rows = Math.min((total + fillers) / cols, 6);
        gridEl.style.setProperty('--ftl-rerun-cols', String(cols));
        gridEl.style.setProperty('--ftl-rerun-rows', String(rows));

        for (const room of rooms) {
            const cell = document.createElement('div');
            cell.className = 'ftl-rerun-cell';

            // Tile styling reuses the site's own utility classes so it matches
            // the native stream grid exactly.
            const tile = document.createElement('button');
            tile.className = 'ftl-rerun-tile group relative overflow-hidden w-full h-full isolate cursor-pointer'
                + ' bg-gradient-to-t from-dark-500 via-dark-600 to-dark-600 shadow-panel rounded-md'
                + ' transition-all duration-100 hover:outline-2 hover:outline-tertiary-400 hover:outline-offset-4'
                + ' hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-tertiary-400'
                + ' focus-visible:outline-offset-4 focus-visible:scale-[1.02] active:scale-[0.98]';
            tile.dataset.room = room;
            tile.innerHTML = `
            <div class="relative w-full h-full bg-dark-800">
                <img class="ftl-rerun-tile-thumb absolute inset-0 z-[1] w-full h-full object-cover" alt="">
                <div class="ftl-rerun-tile-name absolute left-0 z-[3] text-light-text text-shadow-lg font-bold top-0 p-2 text-lg leading-none group-hover:text-link group-focus-visible:text-link"></div>
                <div class="ftl-rerun-tile-noise absolute inset-0 z-[2] overflow-hidden bg-dark-800 pointer-events-none">
                    <div class="absolute -top-32 -left-32 right-0 bottom-0 opacity-30 animate-archive-live-static" style="background-image: url(&quot;${NOISE_SVG}&quot;); background-size: 128px 128px;"></div>
                    <div class="absolute inset-0 bg-dark-900/40"></div>
                </div>
                <div class="ftl-rerun-tile-center absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1 px-2 text-center pointer-events-none">
                    <div class="ftl-rerun-tile-status font-secondary uppercase tabular-nums text-light-text/50 text-shadow-md text-[clamp(9px,1.1vw,13px)]">…</div>
                </div>
            </div>`;
            tile.querySelector('.ftl-rerun-tile-name').textContent = formatRoomLabel(room);
            const thumb = tile.querySelector('.ftl-rerun-tile-thumb');
            thumb.addEventListener('load', () => tile.classList.add('ftl-rerun-has-thumb'));
            thumb.addEventListener('error', () => {
                // No thumbnail for this chunk — fall back to the status look.
                tile.classList.remove('ftl-rerun-has-thumb');
                thumb.removeAttribute('src');
            });
            tile.addEventListener('click', () => focusRoom(room));
            cell.appendChild(tile);
            gridEl.appendChild(cell);
        }
        for (let i = 0; i < fillers; i++) {
            const filler = document.createElement('div');
            filler.className = 'ftl-rerun-cell hidden lg:block';
            filler.innerHTML = '<div class="relative w-full h-full bg-gradient-to-t from-dark-500 via-dark-600 to-dark-600 shadow-panel rounded-md"></div>';
            gridEl.appendChild(filler);
        }
        overlay.appendChild(gridEl);
    }

    async function refreshTiles() {
        if (!gridEl) return;
        const now = virtualNow();
        if (now == null) return;
        const rooms = getSeasonRooms();
        await Promise.all(rooms.map(async (room) => {
            try {
                const state = await getRoomStateAt(room, now);
                tileStates.set(room, state);
            } catch {
                tileStates.set(room, { status: 'unknown' });
            }
        }));
        renderTileCountdowns();
        refreshTileThumbs();
    }

    /**
     * Point each on-air tile's thumbnail at the frame for the current
     * virtual moment. Runs on the tile refresh cadence (~30s) — the site's
     * own grid refreshes previews at a similar rate. Missing thumbnails
     * fall back to the status look via the img error handler.
     */
    function refreshTileThumbs() {
        if (!gridEl) return;
        const now = virtualNow();
        if (now == null) return;
        for (const tile of gridEl.querySelectorAll('.ftl-rerun-tile')) {
            const img = tile.querySelector('.ftl-rerun-tile-thumb');
            if (!img) continue;
            const state = tileStates.get(tile.dataset.room);
            const onAir = state?.status === 'on-air' && (state.nominalEndMs == null || now < state.nominalEndMs);
            if (!onAir || !state.chunk) {
                tile.classList.remove('ftl-rerun-has-thumb');
                img.removeAttribute('src');
                continue;
            }
            const startMs = parseShowTime(state.chunk.startsAt);
            const url = thumbnailUrl(state.chunk.fileName, (now - startMs) / 1000);
            if (url && img.getAttribute('src') !== url) img.src = url;
        }
    }

    /**
     * Status line for a zone's hover label — same logic as the grid tiles.
     */
    function zoneStatusText(room) {
        const state = tileStates.get(room);
        const now = virtualNow();
        if (!state || state.status === 'unknown' || now == null) return '';
        const onAir = state.status === 'on-air' && (state.nominalEndMs == null || now < state.nominalEndMs);
        if (onAir) return '● On Air';
        return state.nextStartsAtMs != null && state.nextStartsAtMs > now
            ? `No Signal — ${formatCountdown(state.nextStartsAtMs - now)}`
            : 'No Signal';
    }

    function renderTileCountdowns() {
        if (!gridEl) return;
        const now = virtualNow();
        if (now == null) return;
        for (const tile of gridEl.querySelectorAll('.ftl-rerun-tile')) {
            const state = tileStates.get(tile.dataset.room);
            const statusEl = tile.querySelector('.ftl-rerun-tile-status');
            const onAir = state?.status === 'on-air' && (state.nominalEndMs == null || now < state.nominalEndMs);
            tile.classList.toggle('ftl-rerun-on-air', onAir);
            if (!onAir) tile.classList.remove('ftl-rerun-has-thumb');
            if (!state || state.status === 'unknown') {
                statusEl.textContent = '…';
                statusEl.classList.remove('on-air');
            } else if (onAir) {
                statusEl.textContent = '● On Air';
                statusEl.classList.add('on-air');
            } else if (state.status === 'on-air') {
                // Cached on-air state has aged past the chunk's nominal end —
                // show as off-air with a countdown until the next refresh
                // re-resolves it properly.
                statusEl.classList.remove('on-air');
                statusEl.textContent = state.nextStartsAtMs != null && state.nextStartsAtMs > now
                    ? `No Signal — ${formatCountdown(state.nextStartsAtMs - now)}`
                    : 'No Signal';
            } else {
                statusEl.classList.remove('on-air');
                statusEl.textContent = state.nextStartsAtMs != null
                    ? `No Signal — ${formatCountdown(state.nextStartsAtMs - now)}`
                    : 'No Signal';
            }
        }
    }

    // ── Focused player ──────────────────────────────────────────────────

    function buildPlayer() {
        playerEl = document.createElement('div');
        playerEl.className = 'ftl-rerun-player';

        videoEl = document.createElement('video');
        videoEl.playsInline = true;
        videoEl.preload = 'auto';
        videoEl.volume = get(VOLUME_KEY, 1);
        videoEl.addEventListener('ended', () => {
            if (currentChunk && videoEl.duration && videoEl.duration !== Infinity) {
                endedChunk = { fileName: currentChunk.fileName, duration: videoEl.duration };
            }
            syncPlayback(true);
        });
        videoEl.addEventListener('error', onVideoError);
        videoEl.addEventListener('loadedmetadata', () => applySeek());

        const roomLabel = document.createElement('div');
        roomLabel.className = 'ftl-rerun-room-label';

        const noSignal = document.createElement('div');
        noSignal.className = 'ftl-rerun-nosignal';
        const nsLabel = document.createElement('div');
        nsLabel.className = 'ftl-rerun-nosignal-label';
        nsLabel.textContent = 'No Signal';
        const nsCountdown = document.createElement('div');
        nsCountdown.className = 'ftl-rerun-nosignal-countdown';
        noSignal.append(nsLabel, nsCountdown);

        // Site-style close button (top right) — returns to the grid.
        const closeBtn = siteIconButton('Back to grid', CLOSE_ICON_SVG, exitFocused, 'primary');
        closeBtn.classList.add('ftl-rerun-close-btn', 'absolute', 'top-0', 'right-0', 'm-2', 'z-5');

        // Bottom-left cluster: mute button + volume slider (site style),
        // plus our extras (Pause, Zones — inserted by the zones module —
        // and Fullscreen).
        const bar = document.createElement('div');
        bar.className = 'ftl-rerun-player-bar';

        const muteBtn = document.createElement('button');
        muteBtn.className = 'ftl-rerun-volume-btn';
        muteBtn.title = 'Mute';
        muteBtn.addEventListener('click', () => {
            videoEl.muted = !videoEl.muted;
            updateVolumeIcon(muteBtn);
        });

        const volume = document.createElement('input');
        volume.type = 'range';
        volume.min = '0';
        volume.max = '1';
        volume.step = '0.01';
        volume.value = String(videoEl.volume);
        volume.className = 'w-[128px] accent-primary bg-transparent rounded-md cursor-pointer';
        volume.addEventListener('input', () => {
            videoEl.volume = Number(volume.value);
            videoEl.muted = false;
            set(VOLUME_KEY, videoEl.volume);
            updateVolumeIcon(muteBtn);
        });
        updateVolumeIcon(muteBtn);

        const pauseBtn = makePauseButton();

        // Share: copy a link to this exact moment + room to the clipboard
        const shareBtn = siteTextButton('Copy a share link for this moment', 'Share', () => {
            const code = encodeShareCode(getSetting('rerunSeason'), virtualNow(), focusedRoom);
            if (!code) return;
            const url = shareUrl(code);
            const face = shareBtn.firstElementChild;
            navigator.clipboard.writeText(url).then(() => {
                face.textContent = 'Copied!';
                setTimeout(() => { face.textContent = 'Share'; }, 2000);
            }).catch(() => {
                prompt('Copy this share link:', url);
            });
        });

        bar.append(muteBtn, volume, pauseBtn, makeNudgeButtons(), shareBtn);
        if (isPreviewActive()) bar.appendChild(makePreviewControls());
        if (getSetting('enhancedTheatreMode')) {
            bar.appendChild(siteIconButton('Theater Mode (T)', THEATRE_ICON_SVG, () => toggleTheatre()));
        }
        bar.appendChild(siteIconButton('Fullscreen (F)', EXPAND_ICON_SVG, () => {
            if (document.fullscreenElement) document.exitFullscreen();
            else playerEl.requestFullscreen();
        }));

        // Bottom-right: Day + show-time clock, styled like the site's.
        const clockWrap = document.createElement('div');
        clockWrap.className = 'ftl-rerun-player-clock flex items-center gap-3 font-secondary text-light-text text-shadow-md text-sm leading-none pointer-events-none';
        playerClockDay = document.createElement('span');
        playerClockTime = document.createElement('span');
        clockWrap.append(playerClockDay, playerClockTime);

        playerEl.append(videoEl, roomLabel, noSignal, bar, clockWrap, closeBtn);
        overlay.appendChild(playerEl);

        // Auto-hide the controls after idle, like a native video player —
        // keeps the bar (and fullscreen) clean while just watching.
        let idleTimer = null;
        const goIdle = () => {
            if (!playerEl) return;
            // Don't hide while the pointer is resting on the controls
            if (playerEl.querySelector('.ftl-rerun-player-bar:hover')) {
                idleTimer = setTimeout(goIdle, 1000);
                return;
            }
            playerEl.classList.add('ftl-rerun-idle');
        };
        const wake = () => {
            if (!playerEl) return;
            playerEl.classList.remove('ftl-rerun-idle');
            clearTimeout(idleTimer);
            idleTimer = setTimeout(goIdle, 2500);
        };
        playerEl.addEventListener('mousemove', wake);
        playerEl.addEventListener('pointerdown', wake);
        wake();

        // Clickable door zones — clicking a doorway switches rooms; hover
        // labels carry the same on-air/countdown status as the grid tiles
        initZones(playerEl, videoEl, (room) => focusRoom(room), {
            getRoomStatus: zoneStatusText,
        });
    }

    // Speaker icons matching the site's player (muted / low / medium / high).
    const VOLUME_ICONS = {
        mute: '<path fill="none" stroke-linecap="square" stroke-miterlimit="10" stroke-width="32" d="M416 432 64 80"></path><path d="M352 256c0-24.56-5.81-47.88-17.75-71.27L327 170.47 298.48 185l7.27 14.25C315.34 218.06 320 236.62 320 256a112.91 112.91 0 0 1-.63 11.74l27.32 27.32A148.8 148.8 0 0 0 352 256zm64 0c0-51.19-13.08-83.89-34.18-120.06l-8.06-13.82-27.64 16.12 8.06 13.82C373.07 184.44 384 211.83 384 256c0 25.93-3.89 46.21-11 65.33l24.5 24.51C409.19 319.68 416 292.42 416 256z"></path><path d="M480 256c0-74.26-20.19-121.11-50.51-168.61l-8.61-13.49-27 17.22 8.61 13.49C429.82 147.38 448 189.5 448 256c0 48.76-9.4 84-24.82 115.55l23.7 23.7C470.16 351.39 480 309 480 256zM256 72l-73.6 58.78 73.6 73.59V72zM32 176.1v159.8h93.65L256 440V339.63L92.47 176.1H32z"></path>',
        low: '<path d="m391.12 341.48-28.6-14.36 7.18-14.3c9.49-18.9 14.3-38 14.3-56.82 0-19.36-4.66-37.92-14.25-56.73L362.48 185 391 170.48l7.26 14.25C410.2 208.16 416 231.47 416 256c0 23.83-6 47.78-17.7 71.18zM189.65 176.1H96v159.8h93.65L320 440V72L189.65 176.1z"></path>',
        med: '<path d="M157.65 176.1H64v159.8h93.65L288 440V72L157.65 176.1z"></path><path fill="none" stroke-linecap="square" stroke-linejoin="round" stroke-width="32" d="M352 320c9.74-19.41 16-40.81 16-64 0-23.51-6-44.4-16-64m48 176c19.48-34 32-64 32-112s-12-77.7-32-112"></path>',
        high: '<path fill="none" stroke-linecap="square" stroke-miterlimit="10" stroke-width="32" d="M320 320c9.74-19.38 16-40.84 16-64 0-23.48-6-44.42-16-64m48 176c19.48-33.92 32-64.06 32-112s-12-77.74-32-112m48 272c30-46 48-91.43 48-160s-18-113-48-160"></path><path d="M125.65 176.1H32v159.8h93.65L256 440V72L125.65 176.1z"></path>',
    };

    function updateVolumeIcon(btn) {
        if (!videoEl) return;
        const v = videoEl.volume;
        // Keep the slider honest too: it shows 0 while muted
        const slider = playerEl?.querySelector('.ftl-rerun-player-bar input[type="range"]');
        if (slider) slider.value = videoEl.muted ? '0' : String(v);
        const key = (videoEl.muted || v === 0) ? 'mute' : v < 0.34 ? 'low' : v < 0.67 ? 'med' : 'high';
        btn.title = key === 'mute' ? 'Unmute' : 'Mute';
        btn.innerHTML = '<svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512"'
            + ' class="text-light-text drop-shadow-[1px_1px_0_#00000075]" height="18" width="18"'
            + ` xmlns="http://www.w3.org/2000/svg">${VOLUME_ICONS[key]}</svg>`;
    }

    function focusRoom(room) {
        focusedRoom = room;
        currentChunk = null;
        endedChunk = null;
        prefetched = null;
        playerNextStartsAtMs = null;
        errorRetries = 0;
        overlay.classList.add('ftl-rerun-focused');
        playerEl.querySelector('.ftl-rerun-room-label').textContent = formatRoomLabel(room);
        setZonesRoom(room);
        syncPlayback(true);
    }

    function exitFocused() {
        if (!focusedRoom) return;
        // Theatre was applied to the focused player — leave it before the
        // overlay reverts to the grid, or the grid inherits theatre layout.
        if (isTheatreActive()) exitTheatre();
        focusedRoom = null;
        currentChunk = null;
        endedChunk = null;
        prefetched = null;
        playerNextStartsAtMs = null;
        if (resyncTimeout) { clearTimeout(resyncTimeout); resyncTimeout = null; }
        if (videoEl) {
            videoEl.pause();
            videoEl.removeAttribute('src');
            videoEl.load();
        }
        setZonesRoom(null);
        overlay?.classList.remove('ftl-rerun-focused');
        refreshTiles();
    }

    function setNoSignal(visible) {
        playerEl?.querySelector('.ftl-rerun-nosignal')?.classList.toggle('visible', visible);
    }

    let playerNextStartsAtMs = null;

    function renderPlayerCountdown() {
        if (!playerEl || !focusedRoom) return;
        const el = playerEl.querySelector('.ftl-rerun-nosignal-countdown');
        const now = virtualNow();
        if (playerNextStartsAtMs != null && now != null) {
            const remaining = playerNextStartsAtMs - now;
            el.textContent = remaining > 0 ? `Resumes in ${formatCountdown(remaining)}` : '';
            // Countdown expired — footage should be back
            if (remaining <= 0 && !isPaused()) {
                playerNextStartsAtMs = null;
                syncPlayback(true);
            }
        } else {
            el.textContent = '';
        }
        maybePrefetchNext();
    }

    /**
     * Core sync: make the video element reflect the virtual clock.
     * force=true re-resolves the chunk even if one is already loaded.
     */
    let syncing = false;
    async function syncPlayback(force) {
        if (!focusedRoom || !videoEl || syncing) return;
        if (isPaused()) { videoEl.pause(); return; }
        syncing = true;
        const room = focusedRoom;
        try {
            const now = virtualNow();
            if (now == null) return;

            // Same chunk already loaded — just correct drift
            if (!force && currentChunk) {
                const startMs = parseShowTime(currentChunk.startsAt);
                const offset = (now - startMs) / 1000;
                if (videoEl.duration && offset >= 0 && offset < videoEl.duration) {
                    if (Math.abs(videoEl.currentTime - offset) > DRIFT_TOLERANCE_S) {
                        videoEl.currentTime = offset;
                    }
                    if (videoEl.paused) tryPlay();
                    return;
                }
                // Fallthrough: clock has left the loaded chunk
            }

            const state = await getRoomStateAt(room, virtualNow());
            if (focusedRoom !== room || !videoEl) return;

            if (state.status === 'on-air') {
                // The nominal window can outlast the chunk's real footage
                // (the ~1s seam between chunks, or a short gap). If we've
                // already played this chunk to its end, bridge with No
                // Signal until the next chunk actually starts.
                if (endedChunk && state.chunk.fileName === endedChunk.fileName
                    && state.offsetSeconds >= endedChunk.duration) {
                    currentChunk = null;
                    videoEl.pause();
                    playerNextStartsAtMs = state.nextStartsAtMs ?? null;
                    setNoSignal(true);
                    scheduleResync(state.nextStartsAtMs);
                    return;
                }
                if (endedChunk && state.chunk.fileName !== endedChunk.fileName) {
                    endedChunk = null;
                }
                playerNextStartsAtMs = null;
                await loadChunk(state.chunk);
            } else {
                currentChunk = null;
                videoEl.pause();
                videoEl.removeAttribute('src');
                videoEl.load();
                playerNextStartsAtMs = state.nextStartsAtMs ?? null;
                setNoSignal(true);
                scheduleResync(state.nextStartsAtMs);
            }
        } finally {
            syncing = false;
        }
    }

    async function loadChunk(chunk) {
        const room = focusedRoom;
        let url = (prefetched && prefetched.fileName === chunk.fileName) ? prefetched.url : null;
        prefetched = null;
        if (!url) url = await getChunkUrl(chunk);
        if (focusedRoom !== room || !videoEl) return;
        if (!url) {
            // Signed URL fetch failed (logged out / API error) — treat as
            // No Signal and retry in 30s.
            setNoSignal(true);
            scheduleResync(null);
            return;
        }
        currentChunk = chunk;
        errorRetries = 0;
        setNoSignal(false);
        // Poster shows the correct moment's frame while the video loads
        // (same trick as the site's player; harmless if the thumb 404s).
        const startMs = parseShowTime(chunk.startsAt);
        const poster = thumbnailUrl(chunk.fileName, (virtualNow() - startMs) / 1000);
        if (poster) videoEl.poster = poster;
        videoEl.src = url;
        // applySeek() runs on loadedmetadata
    }

    /**
     * Seek to the virtual offset once metadata is available. If the
     * offset overshoots the chunk's real duration, the moment falls in a
     * gap → No Signal until the next chunk.
     */
    function applySeek() {
        if (!videoEl || !currentChunk || isPaused()) return;
        const now = virtualNow();
        const startMs = parseShowTime(currentChunk.startsAt);
        const offset = (now - startMs) / 1000;
        if (Number.isNaN(videoEl.duration) || videoEl.duration === Infinity) return;
        if (offset < 0 || offset >= videoEl.duration) {
            if (offset >= videoEl.duration) {
                endedChunk = { fileName: currentChunk.fileName, duration: videoEl.duration };
            }
            currentChunk = null;
            videoEl.pause();
            setNoSignal(true);
            syncPlayback(true); // resolve the actual next chunk / countdown
            return;
        }
        videoEl.currentTime = offset;
        setNoSignal(false);
        tryPlay();
    }

    let playRetryInstalled = false;

    function tryPlay() {
        videoEl.play().catch(() => {
            // Audible autoplay blocked (no user gesture yet — e.g. a share
            // link; Firefox is strict about this). Muted playback is
            // allowed everywhere, so fall back to that and restore sound
            // on the first interaction.
            if (!videoEl) return;
            const restoreSound = !videoEl.muted;
            videoEl.muted = true;
            const volBtn = playerEl?.querySelector('.ftl-rerun-volume-btn');
            if (volBtn) updateVolumeIcon(volBtn);
            if (restoreSound) {
                document.addEventListener('pointerdown', () => {
                    if (!videoEl || !focusedRoom) return;
                    videoEl.muted = false;
                    if (volBtn) updateVolumeIcon(volBtn);
                    if (!isPaused()) videoEl.play().catch(() => {});
                }, { once: true });
            }
            videoEl.play().catch(() => {
                // Even muted playback refused — retry on interactions
                if (playRetryInstalled) return;
                playRetryInstalled = true;
                const retry = () => {
                    if (!videoEl || !focusedRoom || isPaused()) return;
                    videoEl.play().then(() => {
                        playRetryInstalled = false;
                        document.removeEventListener('pointerdown', retry);
                        document.removeEventListener('keydown', retry);
                    }).catch(() => {});
                };
                document.addEventListener('pointerdown', retry);
                document.addEventListener('keydown', retry);
            });
        });
    }

    function scheduleResync(nextStartsAtMs) {
        if (resyncTimeout) clearTimeout(resyncTimeout);
        const now = virtualNow();
        let delay = 30000; // default retry
        if (nextStartsAtMs != null && now != null) {
            delay = Math.max(1000, nextStartsAtMs - now + 1000);
        }
        resyncTimeout = setTimeout(() => syncPlayback(true), delay);
    }

    function onVideoError() {
        if (!focusedRoom || !currentChunk) return;
        // Most likely an expired signed URL — re-request once, then back off
        const chunk = currentChunk;
        currentChunk = null;
        prefetched = null;
        if (errorRetries < 2) {
            errorRetries++;
            setTimeout(() => {
                if (focusedRoom) loadChunk(chunk);
            }, errorRetries === 1 ? 1000 : 5000);
        } else {
            setNoSignal(true);
            scheduleResync(null);
        }
    }

    /**
     * Prefetch the next chunk's signed URL shortly before the current one
     * ends, for a near-gapless handover.
     */
    let prefetching = false;
    async function maybePrefetchNext() {
        if (!focusedRoom || !videoEl || !currentChunk || prefetching || isPaused()) return;
        if (!videoEl.duration || videoEl.duration === Infinity) return;
        const remaining = videoEl.duration - videoEl.currentTime;
        if (remaining > PREFETCH_LEAD_S || remaining <= 0) return;
        const room = focusedRoom;
        prefetching = true;
        try {
            const chunkEndMs = parseShowTime(currentChunk.startsAt) + videoEl.duration * 1000;
            const state = await getRoomStateAt(room, chunkEndMs + 2000);
            if (focusedRoom !== room) return;
            if (state.status === 'on-air' && state.chunk.fileName !== currentChunk?.fileName
                && prefetched?.fileName !== state.chunk.fileName) {
                const url = await getChunkUrl(state.chunk);
                if (url && focusedRoom === room) {
                    prefetched = { fileName: state.chunk.fileName, url };
                }
            }
        } catch { /* prefetch is best-effort */ }
        finally { prefetching = false; }
    }

    /**
     * rerun-panel.js — Re-run status panel in the site's left sidebar
     *
     * A compact panel styled exactly like the site's own sidebar panels
     * (Events / Missions / Inventory), inserted between Missions and
     * Inventory. Shows the season and the live re-run clock, with
     * pause/resume, Open Player, and Clear controls, and collapses like
     * its neighbours (collapse state persists).
     *
     * Injection is fail-silent: no sidebar (mobile) or changed markup
     * simply means no panel. Gated by the rerunSidebarPanel setting.
     */


    const PANEL_ID = 'ftl-rerun-sidebar-panel';
    const COLLAPSED_KEY = 'rerun-panel-collapsed';

    // Icons: site react-icons paths (IoPause / IoPlay / IoRemove / IoAdd)
    const PAUSE_SVG = '<svg viewBox="0 0 512 512" fill="currentColor" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg"><path d="M208 432h-48a16 16 0 0 1-16-16V96a16 16 0 0 1 16-16h48a16 16 0 0 1 16 16v320a16 16 0 0 1-16 16zm144 0h-48a16 16 0 0 1-16-16V96a16 16 0 0 1 16-16h48a16 16 0 0 1 16 16v320a16 16 0 0 1-16 16z"></path></svg>';
    const PLAY_SVG = '<svg viewBox="0 0 512 512" fill="currentColor" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg"><path d="M133 440a35.37 35.37 0 0 1-17.5-4.67c-12-6.8-19.46-20-19.46-34.33V111c0-14.37 7.46-27.53 19.46-34.33a35.13 35.13 0 0 1 35.77.45l247.85 148.36a36 36 0 0 1 0 61l-247.89 148.4A35.5 35.5 0 0 1 133 440z"></path></svg>';
    const MINUS_SVG = '<svg viewBox="0 0 512 512" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="round" stroke-width="32" d="M400 256H112"></path></svg>';
    const PLUS_SVG = '<svg viewBox="0 0 512 512" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg"><path fill="none" stroke="currentColor" stroke-linecap="square" stroke-linejoin="round" stroke-width="32" d="M256 112v288m144-144H112"></path></svg>';

    let panel = null;
    let interval = null;
    let els = null; // { activeBox, emptyBox, seasonEl, clockEl, pauseBtn, pauseFace }
    let seasonLoadRequested = false;

    // Compact icon button matching the site's small sidebar header buttons
    function headerButton(title, svg, variant, onClick) {
        const shells = {
            dark: ['from-dark-400/75 to-dark-500/75', 'from-dark-300 to-dark-400 active:from-dark-400 active:to-dark-300'],
            primary: ['from-primary-400 to-primary-500/90 active:to-primary-600/75', 'from-primary-400 to-primary-500 active:from-primary-500 active:to-primary-300'],
        }[variant];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.title = title;
        btn.className = `bg-gradient-to-r ${shells[0]} p-0.5 inline-flex items-center justify-center`
            + ' cursor-pointer rounded-md hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary';
        const face = document.createElement('div');
        face.className = `text-light-text bg-gradient-to-t ${shells[1]} active:bg-gradient-to-b`
            + ' border-light/25 active:border-light/15 p-0.5 rounded-sm';
        face.innerHTML = svg;
        btn.appendChild(face);
        btn.addEventListener('click', onClick);
        return { btn, face };
    }

    // Compact text button matching the site's small full-width buttons
    // (e.g. the Stox button under the portfolio)
    function smallTextButton(text, variant, onClick) {
        const shells = {
            secondary: ['from-secondary-500 to-secondary-600/75 active:to-secondary-700/90', 'from-secondary-400 to-secondary-500 active:from-secondary-500 active:to-secondary-300'],
            primary: ['from-primary-400 to-primary-500/90 active:to-primary-700/90', 'from-primary-400 to-primary-500 active:from-primary-500 active:to-primary-300'],
        }[variant];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `bg-gradient-to-r ${shells[0]} h-[24px] px-0.5 inline-flex items-center justify-center`
            + ' text-center rounded-md cursor-pointer hover:brightness-105 focus-visible:outline-1'
            + ' focus-visible:outline-tertiary flex-1';
        const face = document.createElement('div');
        face.className = `text-light-text bg-gradient-to-t ${shells[1]} active:bg-gradient-to-b text-shadow-md`
            + ' border-light/25 active:border-light/15 text-sm px-1 flex justify-center items-center'
            + ' h-full w-full m-auto rounded-md border-2 text-center font-medium whitespace-nowrap leading-none';
        face.textContent = text;
        btn.appendChild(face);
        btn.addEventListener('click', onClick);
        return btn;
    }

    function buildPanel() {
        panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.setAttribute('data-ftl-sdk', 'rerun-panel');
        panel.className = 'relative rounded-lg shadow-panel border-t-2 border-b-3 border-l-2 border-r-2'
            + ' text-dark-text bg-light border-t-light-300/75 border-b-light-700/50 border-l-light-300/75'
            + ' border-r-light-700/75 [background-image:var(--texture-panel)] w-full shrink-0 p-1';

        const texture = document.createElement('div');
        texture.className = 'absolute top-0 left-0 w-full h-full pointer-events-none rounded-lg'
            + ' [background-image:var(--texture-panel)] opacity-50 z-[-1]';

        // Header row: title + button cluster (pause/resume, collapse)
        const header = document.createElement('div');
        header.className = 'flex items-center px-1 gap-1.5';
        const title = document.createElement('span');
        title.className = 'font-bold text-sm leading-6 text-dark-text select-none';
        title.textContent = 'Re-run';
        const cluster = document.createElement('div');
        cluster.className = 'ml-auto flex items-center gap-0.5';

        const { btn: pauseBtn, face: pauseFace } = headerButton('Pause re-run clock', PAUSE_SVG, 'dark', () => {
            if (isPaused()) resume(); else pause();
            updatePauseUi(); // keep the overlay's pause buttons in sync
            renderPanel();
        });

        // Collapsible content — same wrapper the site's panels use
        const content = document.createElement('div');
        content.className = 'origin-top overflow-hidden will-change-transform';

        let collapsed = !!get(COLLAPSED_KEY, false);
        const applyCollapse = () => {
            content.style.display = collapsed ? 'none' : '';
            collapseFace.innerHTML = collapsed ? PLUS_SVG : MINUS_SVG;
            collapseBtn.title = collapsed ? 'Expand' : 'Collapse';
        };
        const { btn: collapseBtn, face: collapseFace } = headerButton('Collapse', MINUS_SVG, 'primary', () => {
            collapsed = !collapsed;
            set(COLLAPSED_KEY, collapsed);
            applyCollapse();
        });

        cluster.append(pauseBtn, collapseBtn);
        header.append(title, cluster);

        // Inner dark box, like Events/Missions content
        const inner = document.createElement('div');
        inner.className = 'm-1 bg-dark-700/30 border-2 border-dark-300/50 rounded-lg p-1'
            + ' text-light-text text-shadow-lg shadow-panel-soft';

        // Active state: season + live clock + action buttons
        const activeBox = document.createElement('div');
        const info = document.createElement('div');
        info.className = 'px-1 pt-1 pb-1.5 text-center';
        const seasonEl = document.createElement('div');
        seasonEl.className = 'font-bold text-sm leading-tight';
        const clockEl = document.createElement('div');
        clockEl.className = 'font-secondary tabular-nums text-xs leading-tight mt-0.5 text-green-400';
        info.append(seasonEl, clockEl);

        // Share: copy a link to this exact moment to the clipboard — with
        // the room when the player is open on one, else landing on the grid
        const shareBtn = smallTextButton('Share', 'secondary', () => {
            const code = encodeShareCode(getSetting('rerunSeason'), virtualNow(), getFocusedRoom());
            if (!code) return;
            const url = shareUrl(code);
            const face = shareBtn.firstElementChild;
            navigator.clipboard.writeText(url).then(() => {
                face.textContent = 'Copied!';
                setTimeout(() => { face.textContent = 'Share'; }, 2000);
            }).catch(() => {
                prompt('Copy this share link:', url);
            });
        });

        const btnRow = document.createElement('div');
        btnRow.className = 'flex gap-1 p-0.5';
        btnRow.append(
            smallTextButton('Open Player', 'secondary', () => {
                updateSetting('rerunEnabled', true);
                closeRerunOverlay();
                openRerunOverlay();
            }),
            shareBtn,
            smallTextButton('Clear', 'primary', () => {
                if (!confirm('Clear your re-run start point?')) return;
                clearAnchor();
                closeRerunOverlay();
                renderPanel();
            }),
        );
        activeBox.append(info, btnRow);

        // Empty state, phrased like the site's "Nothing on the schedule yet."
        const emptyBox = document.createElement('div');
        emptyBox.className = 'px-1 py-3 text-center text-light-text/90 text-xs select-none';
        emptyBox.textContent = 'No re-run set. Press E and open the Re-run tab to start one.';

        inner.append(activeBox, emptyBox);
        content.appendChild(inner);
        panel.append(texture, header, content);
        applyCollapse();

        els = { activeBox, emptyBox, seasonEl, clockEl, pauseBtn, pauseFace };
    }

    function renderPanel() {
        if (!panel) return;
        if (!panel.isConnected) {
            // Site re-render dropped us — reset so the injection pass re-adds
            clearInterval(interval);
            interval = null;
            panel = null;
            els = null;
            return;
        }
        const now = virtualNow();
        const active = now != null;
        els.activeBox.style.display = active ? '' : 'none';
        els.emptyBox.style.display = active ? 'none' : '';
        els.pauseBtn.style.display = active ? '' : 'none';
        if (!active) return;

        const season = getSetting('rerunSeason');
        els.seasonEl.textContent = `Season ${parseInt(String(season).replace(/^s0?/, ''), 10) || season}`;

        const day = virtualMsToDayNumber(now);
        if (day == null && !seasonLoadRequested) {
            // Day numbers need the season's day listing — fetch lazily
            seasonLoadRequested = true;
            loadSeasonData().then(() => renderPanel()).catch(() => {});
        }
        const paused = isPaused();
        els.clockEl.textContent = `${day != null ? `Day ${day} · ` : ''}${formatClock(now)}${paused ? ' · Paused' : ''}`;
        els.clockEl.classList.toggle('text-green-400', !paused);
        els.clockEl.classList.toggle('text-primary-400', paused);
        els.pauseFace.innerHTML = paused ? PLAY_SVG : PAUSE_SVG;
        els.pauseBtn.title = paused ? 'Resume re-run clock' : 'Pause re-run clock';
    }

    function tryInjectRerunPanel() {
        if (!getSetting('rerunSidebarPanel')) return;
        if (document.getElementById(PANEL_ID)) return;

        // Anchor on the sidebar's Inventory panel; our panel sits above it
        // (between Missions and Inventory)
        const invTitle = [...document.querySelectorAll('span.font-bold')].find(
            t => t.textContent.trim() === 'Inventory' && t.closest('.shadow-panel'));
        const invPanel = invTitle?.closest('.shadow-panel');
        if (!invPanel) return;

        buildPanel();
        invPanel.insertAdjacentElement('beforebegin', panel);
        renderPanel();
        interval = setInterval(renderPanel, 1000);
    }

    function removeRerunPanel() {
        document.getElementById(PANEL_ID)?.remove();
        if (interval) clearInterval(interval);
        interval = null;
        panel = null;
        els = null;
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

    function setCurrentUsername(name) {
        currentUsername$1 = name;
    }

    function setUserPasses(passes) {
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

    // ── IRC mode ────────────────────────────────────────────────────────

    let ircActive = false;
    let ircSavedPanelStyle = null;
    let ircSavedChild1Style = null;

    function toggleIrcMode() {
        ircActive = !ircActive;

        const panel = document.querySelector('.fixed.bottom-0.right-0');
        const parent = panel?.closest('.relative');
        if (!panel || !parent) return;

        // The chat box is the panel child that contains #chat-input. The site
        // used to put a floorplan/house-map element above it (panel.children[0]),
        // but that's gone — the chat box is now the first child. Locate it by
        // #chat-input rather than a fixed index so this survives layout shuffles.
        const chatInput = panel.querySelector('#chat-input');
        const chatBox = chatInput
            ? [...panel.children].find(c => c.contains(chatInput))
            : panel.children[0];
        if (!chatBox) return;

        // Any legacy map containers that might still exist — hidden only if present.
        const mapAbove = [...panel.children].find(c => c !== chatBox && !c.contains(chatInput));
        const mapInChat = panel.querySelector('.shrink-0.mt-2.pb-2');

        if (ircActive) {
            // Save original inline styles
            ircSavedPanelStyle = panel.style.cssText;
            ircSavedChild1Style = chatBox.style.cssText || '';

            // Hide any leftover map containers (no-op if they don't exist)
            mapAbove?.style.setProperty('display', 'none', 'important');
            mapInChat?.style.setProperty('display', 'none', 'important');

            // Expand chat panel to fill viewport
            panel.style.setProperty('left', '0', 'important');
            panel.style.setProperty('top', '0', 'important');
            panel.style.setProperty('width', '100vw', 'important');
            panel.style.setProperty('height', '100vh', 'important');
            panel.style.setProperty('margin', '0', 'important');
            panel.style.setProperty('transform', 'none', 'important');

            // Make chat box fill the panel
            chatBox.style.setProperty('height', '100%', 'important');

            // Bring parent stacking context above everything
            parent.style.setProperty('z-index', '9999', 'important');
        } else {
            // Restore map containers
            mapAbove?.style.removeProperty('display');
            mapInChat?.style.removeProperty('display');

            // Restore original styles
            panel.style.cssText = ircSavedPanelStyle || '';
            chatBox.style.cssText = ircSavedChild1Style || '';

            // If theatre mode is active, keep z-index high enough to stay above backdrop
            if (document.body.classList.contains('ftl-theatre-mode')) {
                parent.style.setProperty('z-index', '51', 'important');
            } else {
                parent.style.removeProperty('z-index');
            }

            ircSavedPanelStyle = null;
            ircSavedChild1Style = null;
        }

        // Update button state
        const btn = document.querySelector('[data-ftl-sdk="irc-btn"] button');
        if (btn) {
            btn.classList.toggle('opacity-50', !ircActive);
            btn.classList.toggle('saturate-0', !ircActive);
        }
    }

    function isIrcActive() {
        return ircActive;
    }

    function tryInjectIrcButton() {
        // Skip on mobile — mobile layout already works as an IRC-style view
        if (window.innerWidth < 1024) return;

        const chatLabels = document.querySelectorAll('span.font-bold.text-dark-text');
        let chatHeader = null;
        for (const label of chatLabels) {
            if (label.textContent.trim() === 'Chat') {
                chatHeader = label.closest('.flex.items-center.px-1');
                break;
            }
        }
        if (!chatHeader) return;

        if (chatHeader.querySelector('[data-ftl-sdk="irc-btn"]')) return;

        const btnContainer = chatHeader.querySelector('.flex.items-center.gap-0\\.5');
        if (!btnContainer) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'relative translate-y-[2px]';
        wrapper.setAttribute('data-ftl-sdk', 'irc-btn');

        const btn = document.createElement('button');
        btn.className = 'bg-gradient-to-r from-purple-400 to-purple-500/90 active:to-purple-600/75 p-0.5 inline-flex items-center justify-center cursor-pointer rounded-md hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary pointer-events-auto transition-[opacity,filter] duration-300 opacity-50 saturate-0';
        btn.type = 'button';
        btn.title = 'IRC Mode';
        btn.innerHTML = `
        <div class="text-light-text bg-gradient-to-t from-purple-400 to-purple-500 active:bg-gradient-to-b active:from-purple-500 active:to-purple-300 border-light/25 active:border-light/15 p-0.5 rounded-sm">
            <svg viewBox="0 0 24 24" fill="currentColor" width="1em" height="1em" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h12v2H3v-2zm0 4h18v2H3v-2zm0 4h12v2H3v-2z"/>
            </svg>
        </div>
    `;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleIrcMode();
        });

        wrapper.appendChild(btn);
        btnContainer.insertBefore(wrapper, btnContainer.firstChild);
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
            <button data-ftl-tab="rerun" class="bg-gradient-to-r from-secondary-500 to-secondary-600/75 h-[32px] p-0.5 inline-flex items-center justify-center text-center rounded-md cursor-pointer hover:brightness-105 focus-visible:outline-1 focus-visible:outline-tertiary w-full brightness-75" type="button">
                <div class="text-light-text bg-gradient-to-t from-secondary-400 to-secondary-500 text-shadow-md border-light/25 text-md p-1 flex justify-center items-center h-full w-full m-auto rounded-md border-2 text-center font-medium whitespace-nowrap leading-none">Re-run</div>
            </button>
        </div>

        <!-- General tab -->
        <div data-ftl-panel="general">
            ${toggleRow('Auto Close Season Pass Popup', 'autoCloseSeasonPassPopup', getSetting('autoCloseSeasonPassPopup'))}
            ${toggleRow('Keyboard Shortcuts', 'enableKeyboardShortcuts', getSetting('enableKeyboardShortcuts'), 'Q P H X C M S &nbsp;(E always works)')}
            ${toggleRow('Reveal Hidden Clickable Zones', 'revealHiddenZones', getSetting('revealHiddenZones'), 'Highlights secret zones on the video player')}
            ${toggleRow('Enhanced Theatre Mode', 'enhancedTheatreMode', getSetting('enhancedTheatreMode'), 'Replaces site theatre mode (T)')}
            ${toggleRow('Video Stutter Improver', 'videoStutterImprover', getSetting('videoStutterImprover'), 'Auto fixes the video when stutters causes playback issues')}
            ${toggleRow('Archive Grid Saver', 'archiveGridSaver', getSetting('archiveGridSaver'), 'Stops the archive grid downloading every camera at once — click a tile to play it')}
            ${toggleRow('Inventory Search', 'enableInventorySearch', getSetting('enableInventorySearch'), 'Search items in inventory and crafting')}
            ${toggleRow('Sort Inventory by Rarity', 'sortInventoryByRarity', getSetting('sortInventoryByRarity'), 'Order inventory items rarest first')}
            ${toggleRow('Ping Indicator', 'enablePingIndicator', getSetting('enablePingIndicator'), 'Show unread ping button in chat header')}
        </div>

        <!-- Crafting tab -->
        <div data-ftl-panel="crafting" class="hidden">
            ${toggleRow('Show Recipes When Crafting', 'showRecipesWhenCrafting', getSetting('showRecipesWhenCrafting'))}
            ${toggleRow('Show Recipes When Consuming', 'showRecipeWhenConsuming', getSetting('showRecipeWhenConsuming'))}
            <input data-ftl-craft-search type="text" placeholder="Search recipes..." class="font-regular text-md leading-none w-full h-[32px] p-1 mt-2 shadow-md shadow-dark/15 rounded-md bg-gradient-to-t border-1 text-light-text text-shadow-input focus:shadow-lg focus-visible:outline-1 focus-visible:outline-tertiary from-dark-500 via-dark-500 to-dark-600 border-light/50 outline-1 outline-dark/25 mb-2" />
            <div data-ftl-craft-results class="hidden overflow-y-auto border-1 border-dark-400/50 rounded-md px-2 py-1" style="max-height: 400px; scrollbar-width: thin;"></div>
            <div class="text-xs text-center mt-2">Powered by <a href="https://fishtank.guru" target="_blank" class="cursor-pointer text-primary font-heavy hover:underline">fishtank.guru</a></div>
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
            ${toggleRow('Hide TTS Messages', 'hideTTSMessages', getSetting('hideTTSMessages'), 'Remove TTS messages from the chat feed')}
            ${toggleRow('Hide SFX Messages', 'hideSFXMessages', getSetting('hideSFXMessages'), 'Remove SFX messages from the chat feed')}
            ${toggleRow('Hide StoX Messages', 'hideStoxMessages', getSetting('hideStoxMessages'), 'Remove StoX portfolio messages from the chat feed')}
            ${''/* Season Pass monitoring disabled (broken) — toggles hidden for all users:
            userPasses.seasonPass ? toggleRow('Monitor Season Pass Chat', 'monitorSeasonPass', getSetting('monitorSeasonPass'), 'Log messages and pings from Season Pass room') : ''
            */}
            ${''/* userPasses.seasonPassXL ? toggleRow('Monitor Season Pass XL Chat', 'monitorSeasonPassXL', getSetting('monitorSeasonPassXL'), 'Log messages and pings from Season Pass XL room') : '' */}

            <div class="mt-3 pt-3 border-t-1 border-dark-400/50">
                <div class="text-sm font-medium mb-1 opacity-75">Word / Phrase Filters</div>
                <div class="text-xs opacity-40 mb-2">Messages containing these words or phrases will be hidden (case-insensitive)</div>
                <div class="flex gap-1">
                    <input data-ftl-word-filter-input type="text" placeholder="Add a word or phrase..." class="font-regular text-md leading-none w-full h-[32px] p-1 shadow-md shadow-dark/15 rounded-md bg-gradient-to-t border-1 text-light-text text-shadow-input focus:shadow-lg focus-visible:outline-1 focus-visible:outline-tertiary from-dark-500 via-dark-500 to-dark-600 border-light/50 outline-1 outline-dark/25" />
                    <button data-ftl-word-filter-add class="bg-gradient-to-r from-primary-400 to-primary-500/90 h-[32px] px-3 inline-flex items-center justify-center text-center rounded-md cursor-pointer hover:brightness-105" type="button">
                        <div class="text-light-text text-shadow-md text-sm font-medium whitespace-nowrap leading-none">Add</div>
                    </button>
                </div>
                <div data-ftl-word-filter-tags class="flex flex-wrap gap-1 mt-2">${(getSetting('chatWordFilters') || []).map(f =>
        `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-dark-400/50 text-xs text-light-text border-1 border-dark-300/50">
                        <span>${f}</span>
                        <button data-ftl-word-filter-remove="${f}" class="cursor-pointer opacity-50 hover:opacity-100 hover:text-red-400" type="button">&times;</button>
                    </span>`
    ).join('')}</div>
            </div>
        </div>

        <!-- Re-run tab -->
        <div data-ftl-panel="rerun" class="hidden">
            ${toggleRow('Enable Re-run Mode', 'rerunEnabled', getSetting('rerunEnabled'), 'Replay the season archive as if it were live')}
            ${toggleRow('Clock Runs While Away', 'rerunTickWhileAway', getSetting('rerunTickWhileAway'), 'On: time passes even while you’re off the site, like live TV. Off: the clock only ticks while you’re here')}
            ${toggleRow('Clickable Room Zones', 'rerunClickableZones', getSetting('rerunClickableZones'), 'Click doorways in the video to move between rooms')}
            ${toggleRow('12-Hour Clock', 'rerunClock12h', getSetting('rerunClock12h'), 'Show the re-run clock as AM/PM instead of 24-hour')}
            ${toggleRow('Sidebar Panel', 'rerunSidebarPanel', getSetting('rerunSidebarPanel'), "Show a Re-run status panel in the site's left sidebar")}

            <div class="mt-3 pt-3 border-t-1 border-dark-400/50">
                <div class="text-sm font-medium mb-1 opacity-75">Start Point</div>
                <div class="text-xs opacity-40 mb-2">Pick a season, day, and time (show time, US Eastern). The re-run plays forward from there in real time.</div>
                <select data-ftl-rerun-season class="font-regular text-md leading-none w-full h-[32px] p-1 mb-1 shadow-md shadow-dark/15 rounded-md bg-gradient-to-t border-1 text-light-text text-shadow-input focus:shadow-lg focus-visible:outline-1 focus-visible:outline-tertiary from-dark-500 via-dark-500 to-dark-600 border-light/50 outline-1 outline-dark/25">
                    ${AVAILABLE_SEASONS.map(s =>
        `<option class="bg-dark text-light-text" value="${s.value}" ${getSetting('rerunSeason') === s.value ? 'selected' : ''}>${s.label}</option>`
    ).join('')}
                </select>
                <div class="flex gap-1 items-center">
                    <select data-ftl-rerun-day class="font-regular text-md leading-none w-full h-[32px] p-1 shadow-md shadow-dark/15 rounded-md bg-gradient-to-t border-1 text-light-text text-shadow-input focus:shadow-lg focus-visible:outline-1 focus-visible:outline-tertiary from-dark-500 via-dark-500 to-dark-600 border-light/50 outline-1 outline-dark/25">
                        <option class="bg-dark text-light-text">Loading days…</option>
                    </select>
                    <input data-ftl-rerun-time type="text" value="18:00:00" placeholder="HH:mm:ss" style="width:5.2em" class="font-regular text-md leading-none h-[32px] p-1 shadow-md shadow-dark/15 rounded-md bg-gradient-to-t border-1 text-light-text text-shadow-input focus:shadow-lg focus-visible:outline-1 focus-visible:outline-tertiary from-dark-500 via-dark-500 to-dark-600 border-light/50 outline-1 outline-dark/25" />
                    <select data-ftl-rerun-ampm class="hidden font-regular text-md leading-none h-[32px] p-1 shadow-md shadow-dark/15 rounded-md bg-gradient-to-t border-1 text-light-text text-shadow-input focus:shadow-lg focus-visible:outline-1 focus-visible:outline-tertiary from-dark-500 via-dark-500 to-dark-600 border-light/50 outline-1 outline-dark/25">
                        <option class="bg-dark text-light-text" value="AM">AM</option>
                        <option class="bg-dark text-light-text" value="PM">PM</option>
                    </select>
                    <button data-ftl-rerun-start class="bg-gradient-to-r from-primary-400 to-primary-500/90 h-[32px] px-3 inline-flex items-center justify-center text-center rounded-md cursor-pointer hover:brightness-105" type="button">
                        <div class="text-light-text text-shadow-md text-sm font-medium whitespace-nowrap leading-none">Start</div>
                    </button>
                </div>
                <div data-ftl-rerun-status class="text-xs opacity-60 mt-2"></div>
                <div class="flex gap-2 items-center mt-2">
                    <button data-ftl-rerun-open class="bg-gradient-to-r from-secondary-500 to-secondary-600/75 h-[32px] px-3 inline-flex items-center justify-center text-center rounded-md cursor-pointer hover:brightness-105" type="button">
                        <div class="text-light-text text-shadow-md text-sm font-medium whitespace-nowrap leading-none">Open Re-run Player</div>
                    </button>
                    <button data-ftl-rerun-clear class="bg-gradient-to-r from-primary-400 to-primary-500/90 h-[32px] px-3 inline-flex items-center justify-center text-center rounded-md cursor-pointer hover:brightness-105" type="button">
                        <div class="text-light-text text-shadow-md text-sm font-medium whitespace-nowrap leading-none">Clear Re-run</div>
                    </button>
                    <div data-ftl-rerun-clear-confirm class="hidden flex items-center gap-2 text-xs">
                        <span class="opacity-75">Sure?</span>
                        <button data-ftl-rerun-clear-yes class="cursor-pointer text-red-400 hover:opacity-100 font-bold" type="button">Yes</button>
                        <button data-ftl-rerun-clear-no class="cursor-pointer hover:opacity-100" type="button">No</button>
                    </div>
                </div>
                <div class="flex gap-1 items-center mt-2">
                    <input data-ftl-rerun-code type="text" placeholder="Paste a share code or link…" class="font-regular text-md leading-none w-full h-[32px] p-1 shadow-md shadow-dark/15 rounded-md bg-gradient-to-t border-1 text-light-text text-shadow-input focus:shadow-lg focus-visible:outline-1 focus-visible:outline-tertiary from-dark-500 via-dark-500 to-dark-600 border-light/50 outline-1 outline-dark/25" />
                    <button data-ftl-rerun-watch class="bg-gradient-to-r from-secondary-500 to-secondary-600/75 h-[32px] px-3 inline-flex items-center justify-center text-center rounded-md cursor-pointer hover:brightness-105" type="button">
                        <div class="text-light-text text-shadow-md text-sm font-medium whitespace-nowrap leading-none">Watch</div>
                    </button>
                </div>
            </div>
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
        wireUpWordFilters(contentArea);
        wireUpRerun(contentArea);
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
        const chatFilterKeys = ['smartAntiSpam', 'hideTTSMessages', 'hideSFXMessages', 'hideStoxMessages'];

        contentArea.querySelectorAll('[data-ftl-toggle]').forEach(toggle => {
            const key = toggle.getAttribute('data-ftl-toggle');
            const knob = toggle.querySelector('div');
            toggle.addEventListener('click', () => {
                const newVal = !getSetting(key);
                updateSetting(key, newVal);
                knob.classList.toggle('left-[0px]', newVal);
                knob.classList.toggle('left-[calc(100%-16px)]', !newVal);

                // Live-apply the archive grid saver without requiring a reload
                if (key === 'archiveGridSaver') {
                    if (newVal) enableArchiveGridSaver();
                    else disableArchiveGridSaver();
                }

                // Live-apply inventory rarity sorting
                if (key === 'sortInventoryByRarity') {
                    if (newVal) tryApplyInventorySort();
                    else removeInventorySort();
                }

                // Disabling re-run mode closes its player immediately
                if (key === 'rerunEnabled' && !newVal) {
                    closeRerunOverlay();
                }

                // Live-apply zone visibility in an open player
                if (key === 'rerunClickableZones') {
                    refreshZones();
                }

                // Live-switch the Start Point time picker between 12/24-hour
                if (key === 'rerunClock12h') {
                    refreshRerunClockMode?.();
                }

                // Add/remove the sidebar Re-run panel immediately
                if (key === 'rerunSidebarPanel') {
                    if (newVal) tryInjectRerunPanel();
                    else removeRerunPanel();
                }

                // Immediately notify page-level chat filter when any chat setting changes
                if (chatFilterKeys.includes(key)) {
                    window.postMessage({
                        type: 'ftl-chat-filter-settings',
                        settings: Object.fromEntries(chatFilterKeys.map(k => [k, getSetting(k)])),
                    }, '*');
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

    // ── Word filters ────────────────────────────────────────────────────

    function sendWordFiltersToPageScript() {
        const filters = getSetting('chatWordFilters') || [];
        window.postMessage({
            type: 'ftl-chat-filter-settings',
            settings: {
                smartAntiSpam: getSetting('smartAntiSpam'),
                hideTTSMessages: getSetting('hideTTSMessages'),
                hideSFXMessages: getSetting('hideSFXMessages'),
                hideStoxMessages: getSetting('hideStoxMessages'),
                wordFilters: filters,
            },
        }, '*');
    }

    function wireUpWordFilters(contentArea) {
        const input = contentArea.querySelector('[data-ftl-word-filter-input]');
        const addBtn = contentArea.querySelector('[data-ftl-word-filter-add]');
        const tagsContainer = contentArea.querySelector('[data-ftl-word-filter-tags]');
        if (!input || !addBtn || !tagsContainer) return;

        function addFilter(phrase) {
            phrase = phrase.trim();
            if (!phrase) return;
            const filters = getSetting('chatWordFilters') || [];
            if (filters.some(f => f.toLowerCase() === phrase.toLowerCase())) return;
            filters.push(phrase);
            updateSetting('chatWordFilters', filters);
            renderTags();
            sendWordFiltersToPageScript();
        }

        function removeFilter(phrase) {
            const filters = (getSetting('chatWordFilters') || []).filter(f => f !== phrase);
            updateSetting('chatWordFilters', filters);
            renderTags();
            sendWordFiltersToPageScript();
        }

        function renderTags() {
            const filters = getSetting('chatWordFilters') || [];
            tagsContainer.innerHTML = filters.map(f =>
                `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-dark-400/50 text-xs text-light-text border-1 border-dark-300/50">
                <span>${f}</span>
                <button data-ftl-word-filter-remove="${f}" class="cursor-pointer opacity-50 hover:opacity-100 hover:text-red-400" type="button">&times;</button>
            </span>`
            ).join('');

            // Wire up remove buttons
            tagsContainer.querySelectorAll('[data-ftl-word-filter-remove]').forEach(btn => {
                btn.addEventListener('click', () => removeFilter(btn.getAttribute('data-ftl-word-filter-remove')));
            });
        }

        addBtn.addEventListener('click', () => {
            addFilter(input.value);
            input.value = '';
            input.focus();
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopImmediatePropagation();
                addFilter(input.value);
                input.value = '';
            }
        });

        // Wire up initial remove buttons
        tagsContainer.querySelectorAll('[data-ftl-word-filter-remove]').forEach(btn => {
            btn.addEventListener('click', () => removeFilter(btn.getAttribute('data-ftl-word-filter-remove')));
        });
    }

    // ── Re-run panel ────────────────────────────────────────────────────

    // Set by wireUpRerun so the 12-Hour Clock toggle can live-switch the
    // Start Point time picker while the settings modal is open.
    let refreshRerunClockMode = null;

    function wireUpRerun(contentArea) {
        const seasonSelect = contentArea.querySelector('[data-ftl-rerun-season]');
        const daySelect = contentArea.querySelector('[data-ftl-rerun-day]');
        const timeInput = contentArea.querySelector('[data-ftl-rerun-time]');
        const ampmSelect = contentArea.querySelector('[data-ftl-rerun-ampm]');
        const startBtn = contentArea.querySelector('[data-ftl-rerun-start]');
        const openBtn = contentArea.querySelector('[data-ftl-rerun-open]');
        const statusEl = contentArea.querySelector('[data-ftl-rerun-status]');
        if (!daySelect || !startBtn) return;

        // ── 12/24-hour time picker ──────────────────────────────────────
        // The picker is a plain text field, not a native time input: a
        // native input's 12/24-hour display is locked to the browser
        // locale in BOTH directions, so it can't honour the 12-Hour
        // Clock setting. Values cross these helpers as canonical 24h
        // 'HH:MM:SS' either way. mode12 tracks the mode the input is
        // currently RENDERED in — it can lag the setting briefly while
        // applyClockMode converts the shown value.
        let mode12 = false; // markup default '18:00:00' is 24h

        // Canonical 24h 'HH:MM:SS' from the picker, or null if unparseable
        function getPickedTime() {
            const m = timeInput.value.trim().match(/^(\d{1,2})(?::(\d{1,2})(?::(\d{1,2}))?)?$/);
            if (!m) return null;
            let h = Number(m[1]);
            const min = Number(m[2] ?? 0), sec = Number(m[3] ?? 0);
            if (min > 59 || sec > 59) return null;
            if (mode12) {
                if (h < 1 || h > 12) return null;
                if (ampmSelect?.value === 'PM' && h !== 12) h += 12;
                if (ampmSelect?.value === 'AM' && h === 12) h = 0;
            } else if (h > 23) {
                return null;
            }
            return [h, min, sec].map(n => String(n).padStart(2, '0')).join(':');
        }

        // Show a canonical 24h 'HH:MM' / 'HH:MM:SS' in the picker
        function setPickedTime(timeStr) {
            const [h, min, sec] = `${timeStr}:00`.split(':');
            if (!mode12) {
                timeInput.value = `${h}:${min}:${sec}`;
                return;
            }
            timeInput.value = `${((Number(h) + 11) % 12) + 1}:${min}:${sec}`;
            if (ampmSelect) ampmSelect.value = Number(h) >= 12 ? 'PM' : 'AM';
        }

        function applyClockMode() {
            const current = getPickedTime() || '18:00:00'; // read in the old mode before switching
            mode12 = !!getSetting('rerunClock12h');
            timeInput.placeholder = mode12 ? 'h:mm:ss' : 'HH:mm:ss';
            ampmSelect?.classList.toggle('hidden', !mode12);
            setPickedTime(current);
        }
        applyClockMode();
        refreshRerunClockMode = () => { if (timeInput.isConnected) applyClockMode(); };

        // Populate the day picker from the current season's day listing
        function populateDays() {
            daySelect.innerHTML = '<option class="bg-dark text-light-text">Loading days…</option>';
            loadSeasonData().then((ok) => {
                if (!daySelect.isConnected) return;
                if (!ok) {
                    daySelect.innerHTML = '<option class="bg-dark text-light-text">Unavailable — are you logged in with a season pass?</option>';
                    return;
                }
                const days = getSeasonDays();
                daySelect.innerHTML = days
                    .map((d, i) => `<option class="bg-dark text-light-text" value="${i + 1}">Day ${i + 1} — ${d}</option>`)
                    .join('');
                const now = virtualNow();
                if (now != null) {
                    const dayNumber = virtualMsToDayNumber(now);
                    if (dayNumber) daySelect.value = String(dayNumber);
                    if (timeInput) setPickedTime(formatHouseClock(now));
                }
            });
        }
        populateDays();

        // Switching season clears the anchor (day/time don't carry over)
        // and closes any open player until a new start point is picked.
        seasonSelect?.addEventListener('change', () => {
            changeSeason(seasonSelect.value);
            closeRerunOverlay();
            populateDays();
            renderStatus();
        });

        function renderStatus() {
            const now = virtualNow();
            if (!isRerunActive() || now == null) {
                statusEl.textContent = 'No start point set.';
                return;
            }
            const dayNumber = virtualMsToDayNumber(now);
            statusEl.textContent = `Current position: Day ${dayNumber ?? '?'} ${formatClock(now)}`
                + ` (${formatHouseDate(now)})${isPaused() ? ' — paused' : ''}`;
        }
        renderStatus();
        const statusInterval = setInterval(() => {
            if (!statusEl.isConnected) { clearInterval(statusInterval); return; }
            renderStatus();
        }, 1000);

        startBtn.addEventListener('click', () => {
            const picked = getPickedTime();
            const virtualMs = picked == null ? null : dayTimeToVirtualMs(Number(daySelect.value), picked);
            if (virtualMs == null) {
                statusEl.textContent = 'Pick a valid day and time first.';
                return;
            }
            setAnchor(virtualMs);
            updateSetting('rerunEnabled', true);
            dispatchPageEvent('modalClose');
            closeRerunOverlay(); // rebuild fresh if already open
            openRerunOverlay();
        });

        openBtn?.addEventListener('click', () => {
            dispatchPageEvent('modalClose');
            closeRerunOverlay();
            openRerunOverlay();
        });

        // Watch a pasted share code as a preview (own re-run untouched)
        const codeInput = contentArea.querySelector('[data-ftl-rerun-code]');
        const watchBtn = contentArea.querySelector('[data-ftl-rerun-watch]');
        watchBtn?.addEventListener('click', async () => {
            const value = codeInput?.value.trim();
            if (!value) return;
            const err = await watchShareCode(value);
            if (err) {
                statusEl.textContent = err;
                return;
            }
            codeInput.value = '';
            dispatchPageEvent('modalClose');
        });
        codeInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') watchBtn?.click();
        });

        // Clear the set re-run (two-step confirm, same pattern as log clear)
        const clearBtn = contentArea.querySelector('[data-ftl-rerun-clear]');
        const clearConfirm = contentArea.querySelector('[data-ftl-rerun-clear-confirm]');
        const clearYes = contentArea.querySelector('[data-ftl-rerun-clear-yes]');
        const clearNo = contentArea.querySelector('[data-ftl-rerun-clear-no]');

        clearBtn?.addEventListener('click', () => {
            clearBtn.classList.add('hidden');
            clearConfirm.classList.remove('hidden');
        });
        clearNo?.addEventListener('click', () => {
            clearConfirm.classList.add('hidden');
            clearBtn.classList.remove('hidden');
        });
        clearYes?.addEventListener('click', () => {
            clearConfirm.classList.add('hidden');
            clearBtn.classList.remove('hidden');
            closeRerunOverlay();
            clearAnchor();
            if (timeInput) timeInput.value = '18:00';
            renderStatus();
        });
    }

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
    let playerObserver = null;
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
            if (playerObserver) playerObserver.disconnect();

            playerObserver = new MutationObserver(() => {
                scanPlayer();
            });

            playerObserver.observe(container, { childList: true, subtree: true });
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
     * site-zones.js — Clickable room zones on the site's own re-run player
     *
     * When the site runs its "archive live" re-run, the home grid shows
     * archive cameras and clicking one promotes it to a fixed full-area
     * player. This module detects that player, works out the season and
     * room from the video URL, and attaches the same clickable door zones
     * (and zone editor) used by the extension's personal re-run mode.
     * Navigating clicks the target room's grid tile, so the site's own
     * player does the actual switching.
     *
     * Everything is best-effort and fail-silent: if the site changes its
     * markup, or no re-run is running, detection finds nothing and nothing
     * happens. New seasons work automatically — no baked zones means users
     * start from the editor.
     */


    const THUMB_PATH = '/archive-thumbnails/primary/';

    // Season room listing for the editor's target picker (needs login;
    // fail-silent to an empty list, which just skips target filtering).
    let roomsSeason = null;
    let roomsCache = [];

    // The player root the zones module is currently bound to. The dataset
    // marker alone isn't enough: it survives unfocusing, and the zones
    // module may have been re-bound elsewhere in the meantime.
    let boundRoot = null;

    function ensureRooms(season) {
        if (roomsSeason === season) return;
        roomsSeason = season;
        roomsCache = [];
        getRooms$1(season).then((rooms) => {
            if (roomsSeason === season) roomsCache = rooms || [];
        });
    }

    // Archive video URLs are /{season}/{room}/{day}/{file}?token=...
    function parseVideoSrc(src) {
        const m = (src || '').match(/fishtank-archives\.b-cdn\.net\/([^/]+)\/([^/]+)\//);
        return m ? { season: m[1], room: m[2] } : null;
    }

    /**
     * The focused site camera: its content root (a bg-dark-800 div — the
     * same element the video letterboxes inside) promoted into the site's
     * fixed player wrapper. Unfocused grid tiles share the markup but stay
     * in the grid, so requiring a .fixed ancestor isolates the player.
     */
    function findFocusedCamera() {
        for (const root of document.querySelectorAll('div.bg-dark-800')) {
            if (root.closest('[data-ftl-sdk]')) continue;
            if (!root.closest('div.fixed')) continue;
            return { root, video: root.querySelector('video') };
        }
        return null;
    }

    function detectSeasonRoom(cam) {
        const fromSrc = parseVideoSrc(cam.video?.currentSrc || cam.video?.src);
        if (fromSrc) return fromSrc;
        // A No Signal room renders no <video> — fall back to the player's
        // room label, and take the season from any grid thumbnail's video
        // id (thumbnail paths have no season segment, but ids are s03_...).
        const label = cam.root.querySelector('div.text-shadow-lg.font-bold')?.textContent?.trim();
        if (!label) return null;
        const room = label.toLowerCase().replace(/\s+/g, '-');
        for (const img of document.querySelectorAll(`img[src*="${THUMB_PATH}"]`)) {
            const m = img.src.match(/\/(s\d{2})_/);
            if (m) return { season: m[1], room };
        }
        return null;
    }

    /**
     * The grid tile button for a room. The tile's thumbnail URL embeds the
     * room code; No Signal tiles (no thumbnail) match by label text. The
     * grid is invisible while a camera is focused, but programmatic clicks
     * still reach the site's handlers.
     */
    function findTileButton(room) {
        for (const img of document.querySelectorAll(`img[src*="${THUMB_PATH}${room}/"]`)) {
            const btn = img.closest('button');
            if (btn && !btn.closest('div.fixed')) return btn;
        }
        const label = formatRoomLabel(room);
        for (const div of document.querySelectorAll('button div.font-bold')) {
            if (div.textContent.trim() !== label) continue;
            const btn = div.closest('button');
            if (btn && !btn.closest('div.fixed')) return btn;
        }
        return null;
    }

    function navigate(room) {
        const btn = findTileButton(room);
        if (!btn) return;
        btn.click();
        // The newly focused camera renders after React state settles.
        setTimeout(tryInjectSiteZones, 150);
        setTimeout(tryInjectSiteZones, 600);
    }

    /**
     * Mount point for the Zones editor button: the volume flex row in the
     * site player's controls overlay (a separate fixed layer).
     */
    function findControlsMount() {
        for (const input of document.querySelectorAll('div.fixed input[type="range"]')) {
            if (input.closest('[data-ftl-sdk]')) continue;
            return input.parentElement;
        }
        return null;
    }

    /**
     * Injection pass — call from click-injection hooks. Idempotent: the
     * player root is marked with the room it's wired for ('v' = with
     * video, 'n' = No Signal, upgraded to 'v' if the video appears later).
     */
    function tryInjectSiteZones() {
        if (!getSetting('rerunClickableZones')) return;
        // The personal re-run overlay owns the zones module while open.
        if (document.getElementById('ftl-rerun-overlay')) return;
        const cam = findFocusedCamera();
        if (!cam) return;
        const info = detectSeasonRoom(cam);
        if (!info) return;
        const state = `${info.room}:${cam.video ? 'v' : 'n'}`;
        if (boundRoot === cam.root
            && (cam.root.dataset.ftlZones === state
                || cam.root.dataset.ftlZones === `${info.room}:v`)) return;
        cam.root.dataset.ftlZones = state;
        boundRoot = cam.root;
        ensureRooms(info.season);
        initZones(cam.root, cam.video, navigate, {
            getSeason: () => info.season,
            getRooms: () => (roomsSeason === info.season ? roomsCache : []),
            buttonMount: findControlsMount(),
        });
        setZonesRoom(info.room);
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

    // Archive grid saver must install its play() patch BEFORE any grid tile
    // renders and calls play(), so it runs here in pre-ready, not whenReady.
    // The patch is a harmless prototype swap that no-ops while disabled.
    initArchiveGridSaver();



    // Register the SDK's cross-origin transport. The SDK calls this
    // whenever it needs to fetch something the page can't (e.g. audio
    // file downloads). We proxy through the background service worker
    // which runs with host_permissions and isn't bound by CORS.
    register$1(async (url) => {
        const response = await chrome.runtime.sendMessage({
            type: 'ftl-sdk-fetch',
            url,
        });
        if (!response?.ok) {
            throw new Error(response?.error || 'Background fetch failed');
        }
        return new Uint8Array(response.data);
    });

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

        // Re-run mode: apply away-time handling to the virtual clock and
        // start the presence heartbeat. If a re-run is active, open the
        // player automatically — the whole point is that coming back to
        // the site drops you straight back into "live".
        initClockPersistence();
        if (isRerunActive()) {
            openRerunOverlay();
        }

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

        // ── Room setup and reconnect handling ───────────────────────────
        //
        // The backend tracks "current room" per user. Any authenticated
        // socket that connects with a room subscription updates the user's
        // current room on the server, which then gets pushed back to the
        // site's own chat socket — causing the site's chat to switch rooms
        // unexpectedly.
        //
        // To avoid this:
        //   1. Room sockets have auto-reconnect disabled (see SDK).
        //   2. On primary socket disconnect, we tear down all room sockets.
        //   3. On primary reconnect, we wait 3 seconds for the site's own
        //      socket to stabilise, then:
        //        a. Emit chat:room: <snapshotted room> on our primary socket
        //        b. Re-subscribe to each monitored room
        //        c. After each subscription, re-emit chat:room: <snapshot>
        //           again to reset the server's view of current room
        //
        // The snapshot comes from chat-filter.js which watches the store.

        // Rooms we want to monitor — populated from the profile fetch.
        let monitoredRooms = [];
        // Generation counter — incremented on every disconnect. Used to
        // cancel in-flight reconnect flows when a new disconnect happens
        // before the previous restore completed.
        let reconnectGeneration = 0;

        async function reestablishRooms(generation) {
            for (const room of monitoredRooms) {
                // Bail if a newer disconnect has happened
                if (generation !== reconnectGeneration) {
                    return;
                }
                await subscribe(room);
            }
        }

        {
            const raw = getSocket();
            if (raw) {
                raw.on('disconnect', () => {
                    reconnectGeneration++;

                    // Tear down all room sockets. They can't auto-reconnect
                    // any more (we disabled it), so we control re-establishment.
                    unsubscribeAll();
                    window.postMessage({ type: 'ftl-socket-disconnected' }, '*');
                });
                raw.on('connect', async () => {
                    // Tell chat-filter.js we're back — it'll watch the
                    // store for corruption and call changeChatRoom to fix
                    // it immediately if it happens.
                    window.postMessage({ type: 'ftl-socket-reconnected' }, '*');

                    // Re-subscribe to monitored rooms. chat-filter is
                    // already watching and will correct any room flip
                    // this triggers.
                    const myGeneration = reconnectGeneration;
                    await reestablishRooms(myGeneration);
                });
            }
        }

        // ── Post-login sidebar injection watcher ────────────────────────
        // Logged out, the left sidebar holds only the Events panel; logging
        // in makes the site render Missions + Inventory — the anchors our
        // sidebar injections need. Render timing varies wildly (slow while
        // a season is live), so rather than guessing with timeouts we watch
        // the sidebar container for panels appearing — element-scoped like
        // the trade modal's grid observer, debounced, and torn down the
        // moment the work is done. Never observes document/body. React can
        // also swap the whole sidebar node on login, so a disconnected
        // target triggers one re-find rather than a dead observer.
        let sidebarWatchActive = false;

        function watchSidebarForInjection() {
            if (sidebarWatchActive) return;
            if (!getSetting('enableInventorySearch') && !getSetting('rerunSidebarPanel')) return;

            sidebarWatchActive = true;
            const deadline = Date.now() + 120000; // hard cap; click pass backstops after
            let observer = null;
            let findTimer = null;
            let debounce = null;

            const stop = () => {
                sidebarWatchActive = false;
                if (observer) observer.disconnect();
                if (findTimer) clearInterval(findTimer);
                if (debounce) clearTimeout(debounce);
                observer = null; findTimer = null; debounce = null;
            };

            // The sidebar exists even logged out (Events only) — climb from
            // any panel title to its fixed left-edge container.
            const findSidebar = () => {
                const title = [...document.querySelectorAll('span.font-bold')].find(
                    t => t.closest('.shadow-panel')?.closest('div.fixed')?.classList.contains('left-0'));
                return title?.closest('div.fixed') ?? null;
            };

            // Returns true when there's nothing left for the watcher to do
            // (each injection either succeeded or is disabled in settings).
            const attempt = (sidebar) => {
                tryInjectSidebarInventorySearch();
                tryInjectRerunPanel();
                tryApplyInventorySort();
                const searchDone = !getSetting('enableInventorySearch')
                    || !!sidebar.querySelector('[data-ftl-sdk="item-search"]');
                const panelDone = !getSetting('rerunSidebarPanel')
                    || !!sidebar.querySelector('[data-ftl-sdk="rerun-panel"]');
                return searchDone && panelDone;
            };

            const observe = (sidebar) => {
                observer = new MutationObserver(() => {
                    if (debounce) return;
                    debounce = setTimeout(() => {
                        debounce = null;
                        if (Date.now() > deadline) { stop(); return; }
                        if (!sidebar.isConnected) {
                            observer.disconnect(); observer = null;
                            start();
                            return;
                        }
                        if (attempt(sidebar)) stop();
                    }, 150);
                });
                observer.observe(sidebar, { childList: true, subtree: true });
            };

            const start = () => {
                const sidebar = findSidebar();
                if (sidebar) {
                    if (attempt(sidebar)) { stop(); return; }
                    observe(sidebar);
                    return;
                }
                // Sidebar not rendered at all yet — cheap re-check until it
                // is, then hand over to the observer.
                findTimer = setInterval(() => {
                    if (Date.now() > deadline) { stop(); return; }
                    const el = findSidebar();
                    if (!el) return;
                    clearInterval(findTimer); findTimer = null;
                    if (attempt(el)) { stop(); return; }
                    observe(el);
                }, 500);
            };

            start();
        }

        // ── Season Pass room auto-detection ─────────────────────────────
        // Wait for the user's auth cookie to appear, extract their UUID,
        // fetch their profile to check Season Pass status, then subscribe
        // to additional rooms if they have access and haven't turned it off.

        onUserIdDetected((userId) => {

            // Logging in makes the site render the left sidebar's Missions/
            // Inventory panels (logged out it holds only Events) — watch for
            // them appearing rather than guessing at render timing.
            watchSidebarForInjection();

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

                    // Build the list of rooms we want to monitor
                    monitoredRooms = [];
                    // Season Pass monitoring disabled (broken) — never add these
                    // rooms so the settings are effectively off for all users.
                    // if (profile.seasonPass && getSetting('monitorSeasonPass')) {
                    //     monitoredRooms.push('Season Pass');
                    // }
                    // if (profile.seasonPassXL && getSetting('monitorSeasonPassXL')) {
                    //     monitoredRooms.push('Season Pass XL');
                    // }

                    // Initial subscription — uses the same flow as reconnect
                    const subscribed = ['Global'];
                    for (const room of monitoredRooms) {
                        const ok = await subscribe(room);
                        if (ok) {
                            subscribed.push(room);
                        }
                    }

                    // One-time startup announcement — always visible so
                    // users can confirm the extension is running and see
                    // which rooms are being monitored. Lifecycle churn
                    // on reconnects stays gated behind DEBUG.
                    console.log(`[FTL Extended] Ready — monitoring ${subscribed.join(', ')}`);

                    // After initial subscription, reset the server's view
                    // of current room back to Global so the site defaults
                    // correctly on refresh.
                    if (monitoredRooms.length > 0) {
                        const raw = getSocket();
                        if (raw) raw.emit('chat:room', 'Global');
                    }
                })
                .catch(err => {
                    log('Profile fetch failed:', err.message);
                    console.log('[FTL Extended] Ready — monitoring Global (profile fetch failed, Season Pass rooms unavailable)');
                });
        });

        // ── Chat messages via SDK (normalised + structured) ────────────────
        //
        // Two parallel capture paths feed the same handler:
        //   1. chat.messages.onMessage — Socket.IO, structured data, multi-room
        //   2. window.postMessage from chat-filter.js — Zustand store, Global only
        //
        // The store path is a backup for messages the monitoring sockets miss.
        // Dedup happens at the log layer via msg.raw.id, so duplicates are
        // dropped automatically.

        function handleChatMessage(msg, source) {
            log(`[CHAT/${source}]`, msg.username, msg.message);

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
        }

        onMessage((msg) => handleChatMessage(msg, 'socket'));

        // Backup capture from chat-filter.js (page-realm Zustand store)
        window.addEventListener('message', (e) => {
            if (e.source !== window) return;
            if (e.data?.type !== 'ftl-chat-store-message') return;
            if (!e.data.message) return;
            handleChatMessage(e.data.message, 'store');
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
            // Theatre first: when theatre is applied to the re-run player,
            // ESC should peel back one layer at a time (theatre → grid → close).
            if (isTheatreActive()) { exitTheatre(); return; }
            if (handleRerunEscape()) return;
            // Zone editor on the site's own archive player (the personal
            // re-run overlay handles its own zones inside handleRerunEscape)
            if (handleZonesEscape()) return;
            if (isIrcActive()) toggleIrcMode();
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
            setTimeout(tryInjectSidebarInventorySearch, 100);
            setTimeout(tryInjectRerunPanel, 100);
            setTimeout(tryApplyInventorySort, 100);
            setTimeout(tryInjectCraftingItemSearch, 100);
            // VOD player appears after clicking a grid tile — its React
            // render can lag the click, so check twice.
            setTimeout(tryInjectVodControls, 150);
            setTimeout(tryInjectVodControls, 600);
            // Site archive-live player — attach clickable room zones
            setTimeout(tryInjectSiteZones, 150);
            setTimeout(tryInjectSiteZones, 600);
        });

        // ── Hidden clickable zone detection ────────────────────────────────

        initZoneDetection();

        // Sidebar injections are driven by login detection (see
        // watchSidebarForInjection) plus the click pass as a backstop.

        // ── Re-run share links ─────────────────────────────────────────────
        // fishtank.live/#FTL1-s03-D11-181745-kitchen opens that moment as a
        // preview (the user's own re-run position is never touched).

        const shareHash = location.hash.match(/^#(FTL1-[A-Za-z0-9-]+)$/i)?.[1];
        if (shareHash) {
            history.replaceState(null, '', location.pathname + location.search);
            setTimeout(async () => {
                const err = await watchShareCode(shareHash);
                if (err) {
                    notify('Couldn\'t open share link', {
                        description: err, type: 'info', duration: 6000,
                    });
                }
            }, 1200);
        }

        // ── Ping & IRC buttons in chat header ─────────────────────────────

        tryInjectPingButton();
        tryInjectIrcButton();
        setOnPingCountChange(updatePingBadge);

        // ── Theatre mode button intercept ───────────────────────────────

        initTheatreButtonIntercept();

        // ── Video stutter fix ───────────────────────────────────────────
        // The site's HLS player falls behind the live edge and attempts a
        // gradual 1.1x catch-up that causes frame drops and freezing.
        // This fix monitors the video element and snaps to the live edge
        // when playback falls more than 3 seconds behind. It also resets
        // the playback rate to 1x to prevent the decoder from struggling.

        // Setting key is videoStutterImprover (was checking a non-existent
        // 'videoStutterFix' key, so this never ran). Live-edge snapping only
        // makes sense for the HLS player — scope the lookup to it so VOD and
        // re-run playback are never yanked forward.
        if (getSetting('videoStutterImprover')) {
            setInterval(() => {
                const video = document.getElementById('live-stream-player')?.querySelector('video');
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
        const chatFilterKeys = ['smartAntiSpam', 'hideTTSMessages', 'hideSFXMessages', 'hideStoxMessages'];

        function sendChatFilterSettings() {
            const s = Object.fromEntries(chatFilterKeys.map(k => [k, getSetting(k)]));
            s.wordFilters = getSetting('chatWordFilters') || [];
            window.postMessage({ type: 'ftl-chat-filter-settings', settings: s }, '*');
        }

        // Track user ID and keep sending it until the page script confirms receipt
        onUserIdDetected((userId) => {
            detectedUserId = userId;
        });

        // Retry sending user ID and settings every second until confirmed
        const userIdInterval = setInterval(() => {
            if (detectedUserId) {
                window.postMessage({ type: 'ftl-chat-filter-userid', userId: detectedUserId }, '*');
            }
            sendChatFilterSettings();
        }, 1000);

        // Stop retrying user ID once the page script confirms
        window.addEventListener('message', (e) => {
            if (e.data?.type === 'ftl-chat-filter-userid-ack') {
                clearInterval(userIdInterval);
                sendChatFilterSettings();
            }
        });

        const chatFilterScript = document.createElement('script');
        chatFilterScript.src = chrome.runtime.getURL('current/chat-filter.js');
        document.documentElement.appendChild(chatFilterScript);
        chatFilterScript.onload = () => chatFilterScript.remove();

        // ── Startup toast ───────────────────────────────────────────────

        notify('FTL Extended loaded!', {
            description: 'v2.4.1',
            type: 'success',
            duration: 3000,
        });
    });

})();
