const React = require('react');
const renderer = require('react-test-renderer');
const Module = require('module');

const { act } = renderer;

const stubs = new Map();
const moduleCache = Module._cache;
const originalResolve = Module._resolveFilename;

const registerStub = (request, exports) => {
  const virtualId = `virtual:${request}`;
  stubs.set(request, virtualId);
  moduleCache[virtualId] = {
    id: virtualId,
    filename: virtualId,
    loaded: true,
    exports
  };
};

Module._resolveFilename = function (request, parent, isMain, options) {
  if (stubs.has(request)) {
    return stubs.get(request);
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

const createElementWrapper = (tag, displayName) => {
  const Component = ({ children, ...props }) => React.createElement(tag, props, children);
  Object.defineProperty(Component, 'name', { value: displayName });
  Component.displayName = displayName;
  return Component;
};

const ViewComponent = createElementWrapper('div', 'View');
const TextComponent = createElementWrapper('span', 'Text');
const ScrollViewComponent = createElementWrapper('div', 'ScrollView');

registerStub('react-native', {
  __esModule: true,
  View: ViewComponent,
  Text: TextComponent,
  ScrollView: ScrollViewComponent,
  StyleSheet: {
    create(styles) {
      return styles;
    }
  },
  Platform: { OS: 'web', select: options => (options ? options.web ?? options.default : undefined) }
});

registerStub('expo-image-picker', {
  __esModule: true,
  MediaTypeOptions: { Images: 'Images' },
  requestCameraPermissionsAsync: async () => ({ granted: true }),
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
  launchCameraAsync: async () => ({ canceled: true, assets: [] })
});

registerStub('expo-router', {
  __esModule: true,
  useRouter: () => ({ push: () => undefined, replace: () => undefined, back: () => undefined })
});

registerStub('react-native-safe-area-context', {
  __esModule: true,
  SafeAreaProvider: createElementWrapper('div', 'SafeAreaProvider'),
  SafeAreaView: createElementWrapper('div', 'SafeAreaView'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
});

registerStub('react-native/Libraries/Utilities/codegenNativeComponent', {
  __esModule: true,
  default: () => createElementWrapper('div', 'CodegenNativeComponent')
});

const paperExports = (() => {
  const { View, Text } = require('react-native');
  const wrap = name => {
    const Component = ({ children, ...props }) => React.createElement(View, props, children);
    Object.defineProperty(Component, 'name', { value: name });
    return Component;
  };

  const Card = wrap('PaperCard');
  Card.Content = wrap('PaperCardContent');
  Card.Actions = wrap('PaperCardActions');
  Card.Title = ({ title, subtitle }) =>
    React.createElement(View, null, [
      title ? React.createElement(Text, { key: 'title' }, title) : null,
      subtitle ? React.createElement(Text, { key: 'subtitle' }, subtitle) : null
    ]);

  const Dialog = wrap('PaperDialog');
  Dialog.Title = wrap('PaperDialogTitle');
  Dialog.Content = wrap('PaperDialogContent');
  Dialog.Actions = wrap('PaperDialogActions');

  return {
    __esModule: true,
    PaperProvider: ({ children }) => React.createElement(React.Fragment, null, children),
    Card,
    Button: wrap('PaperButton'),
    Chip: wrap('PaperChip'),
    Text: ({ children, ...props }) => React.createElement(Text, props, children),
    TextInput: wrap('PaperTextInput'),
    ActivityIndicator: wrap('PaperSpinner'),
    Divider: wrap('PaperDivider'),
    Portal: ({ children }) => React.createElement(React.Fragment, null, children),
    Dialog,
    Snackbar: ({ visible, children }) => (visible ? React.createElement(Text, null, children) : null)
  };
})();

registerStub('react-native-paper', paperExports);

const flushEffects = () => new Promise(resolve => setImmediate(resolve));

const cleanup = () => {
  Module._resolveFilename = originalResolve;
  for (const id of stubs.values()) {
    delete moduleCache[id];
  }
  stubs.clear();
};

const run = async () => {
  try {
    const DriverDashboard = require('../app/index').default;
    const { PaperProvider } = require('react-native-paper');

    const tree = renderer.create(
      React.createElement(
        PaperProvider,
        null,
        React.createElement(DriverDashboard, null)
      )
    );

    await act(async () => {
      await flushEffects();
    });

    const foundLoginTitle =
      tree.root.findAll(
        node => typeof node.props?.title === 'string' && node.props.title.includes('外送員登入')
      ).length > 0;

    if (!foundLoginTitle) {
      throw new Error('Driver dashboard 未渲染登入卡片');
    }

    console.log('✅ Driver dashboard smoke 測試通過');
    tree.unmount();
    return true;
  } finally {
    cleanup();
  }
};

module.exports = run();
