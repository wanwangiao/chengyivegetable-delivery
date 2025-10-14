import React from 'react';
import renderer from 'react-test-renderer';
import Module from 'module';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const stubs: Record<string, string> = {};
const moduleCache = (Module as any)._cache as Record<string, any>;
const originalResolve = Module._resolveFilename;

const registerStub = (request: string, exports: Record<string, unknown>) => {
  const virtualId = `virtual:${request}`;
  stubs[request] = virtualId;
  moduleCache[virtualId] = {
    id: virtualId,
    filename: virtualId,
    loaded: true,
    exports
  };
};

(Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
  if (stubs[request]) {
    return stubs[request];
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

const createElementWrapper = (tag: string) => {
  const Component = ({ children, ...props }: Record<string, unknown>) => React.createElement(tag, props, children);
  Object.defineProperty(Component, 'name', { value: tag });
  return Component;
};

registerStub('react-native', {
  __esModule: true,
  View: createElementWrapper('RNView'),
  Text: ({ children, ...props }: Record<string, unknown>) => React.createElement('RNText', props, children),
  ScrollView: createElementWrapper('RNScrollView'),
  StyleSheet: {
    create<T>(styles: T): T {
      return styles;
    }
  },
  Platform: { OS: 'web' }
});

registerStub('expo-status-bar', {
  __esModule: true,
  StatusBar: createElementWrapper('ExpoStatusBar')
});

registerStub('expo-image-picker', {
  __esModule: true,
  MediaTypeOptions: { Images: 'Images' },
  requestCameraPermissionsAsync: async () => ({ granted: true }),
  requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
  launchCameraAsync: async () => ({ canceled: true, assets: [] })
});

const paperExports = (() => {
  const { View, Text } = require('react-native');
  const wrap = (name: string) => {
    const Component = ({ children, ...props }: Record<string, unknown>) => React.createElement(View, props, children);
    Object.defineProperty(Component, 'name', { value: name });
    return Component;
  };

  const Card = wrap('PaperCard');
  Card.Content = wrap('PaperCardContent');
  Card.Actions = wrap('PaperCardActions');
  Card.Title = ({ title, subtitle }: Record<string, unknown>) =>
    React.createElement(View, null, [
      title ? React.createElement(Text, { key: 'title' }, title as string) : null,
      subtitle ? React.createElement(Text, { key: 'subtitle' }, subtitle as string) : null
    ]);

  return {
    __esModule: true,
    PaperProvider: ({ children }: Record<string, unknown>) => React.createElement(React.Fragment, null, children),
    Card,
    Button: wrap('PaperButton'),
    Chip: wrap('PaperChip'),
    Text: ({ children, ...props }: Record<string, unknown>) => React.createElement(Text, props, children),
    TextInput: wrap('PaperTextInput'),
    ActivityIndicator: wrap('PaperSpinner'),
    Divider: wrap('PaperDivider'),
    Snackbar: ({ visible, children }: Record<string, unknown>) => (visible ? React.createElement(Text, null, children) : null)
  };
})();

registerStub('react-native-paper', paperExports);

const run = async () => {
  const DriverDashboard = (await import('../app/index')).default;
  const { PaperProvider } = require('react-native-paper') as { PaperProvider: React.ComponentType<any> };

  const tree = renderer.create(
    React.createElement(
      PaperProvider,
      null,
      React.createElement(DriverDashboard, null)
    )
  );

  const foundLoginTitle = tree.root.findAll(
    node => typeof node.props?.title === 'string' && (node.props.title as string).includes('外送員登入')
  ).length > 0;

  if (!foundLoginTitle) {
    console.error('❌ Driver dashboard 未渲染登入卡片');
    process.exit(1);
  }

  console.log('✅ Driver dashboard smoke 測試通過');
};

run().catch(error => {
  console.error('❌ Driver dashboard smoke 測試失敗', error);
  process.exit(1);
});
