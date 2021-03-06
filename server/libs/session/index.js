'use strict';
//copy form koa-session.
const debug = require('debug')('koa-session');
const ContextSession = require('./lib/context');
const util = require('./lib/util');
const assert = require('assert');

const CONTEXT_SESSION = Symbol('context#contextSession');
const _CONTEXT_SESSION = Symbol('context#_contextSession');

/**
 * Initialize session middleware with `opts`:
 *
 * - `key` session cookie name ["koa:sess"]
 * - all other options are passed as cookie options
 *
 * @param {Object} [opts]
 * @param {Application} app, koa application instance
 * @api public
 */

module.exports = function(opts, app) {
    // session(app[, opts])
    if (opts && typeof opts.use === 'function') {
        const tmp = app;
        app = opts;
        opts = tmp;
    }
    // app required
    if (!app || typeof app.use !== 'function') {
        throw new TypeError('app instance required: `session(opts, app)`');
    }

    opts = formatOpts(opts);
    extendContext(app.context, opts);

    return async function session(ctx, next) {
        const sess = ctx[CONTEXT_SESSION];
        if (sess.store) await sess.initFromExternal();
        try {
            await next();
        } catch (err) {
            throw err;
        } finally {
            await sess.commit();
        }
    };
};

/**
 * format and check session options
 * @param  {Object} opts session options
 * @return {Object} new session options
 *
 * @api private
 */

function formatOpts(opts) {
    opts = opts || {};
    // key
    opts.key = opts.key || 'koa:sess';

    // back-compat maxage
    if (!('maxAge' in opts)) opts.maxAge = opts.maxage;

    // defaults
    if (opts.overwrite == null) opts.overwrite = true;
    if (opts.httpOnly == null) opts.httpOnly = true;
    if (opts.signed == null) opts.signed = true;

    debug('session options %j', opts);

    // setup encoding/decoding
    if (typeof opts.encode !== 'function') {
        opts.encode = util.encode;
    }
    if (typeof opts.decode !== 'function') {
        opts.decode = util.decode;
    }

    if (opts.store) {
        assert(typeof opts.store.get === 'function', 'store.get must be function');
        assert(typeof opts.store.set === 'function', 'store.set must be function');
        assert(typeof opts.store.destroy === 'function', 'store.destroy must be function');
    }

    return opts;
}

/**
 * extend context prototype, add session properties
 *
 * @param  {Object} context koa's context prototype
 * @param  {Object} opts session options
 *
 * @api private
 */

function extendContext(context, opts) {
    Object.defineProperties(context, {
        [CONTEXT_SESSION]: {
            get() {
                if (this[_CONTEXT_SESSION]) return this[_CONTEXT_SESSION];
                this[_CONTEXT_SESSION] = new ContextSession(this, opts);
                return this[_CONTEXT_SESSION];
            },
        },
        session: {
            get() {
                return this[CONTEXT_SESSION].get();
            },
            set(val) {
                this[CONTEXT_SESSION].set(val);
            },
            configurable: true,
        },
        sessionOptions: {
            get() {
                return this[CONTEXT_SESSION].opts;
            },
        },
    });
}
