const Module = require("module");

const originalLoad = Module._load;

const noop = () => {};
const asyncNoop = async () => {};

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "@sentry/node") {
    return {
      init: noop,
      captureException: noop,
      captureMessage: noop,
      close: asyncNoop,
      flush: asyncNoop,
      withScope(callback) {
        if (callback) {
          callback({
            setExtra: noop,
            setExtras: noop,
            setTag: noop,
            setTags: noop,
          });
        }
      },
    };
  }
  if (request === "@sentry/tracing") {
    return {};
  }
  return originalLoad.call(this, request, parent, isMain);
};
