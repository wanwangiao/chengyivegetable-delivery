import { afterEach, beforeAll, vi } from 'vitest';
import React from 'react';
import { View, Text } from 'react-native';

const createPaperMock = () => {
  const createComponent = (displayName: string) => {
    const Component = ({ children, ...props }: any) => React.createElement(View, props, children);
    Component.displayName = displayName;
    return Component;
  };

  const TextComponent = ({ children, ...props }: any) => React.createElement(Text, props, children);
  TextComponent.displayName = 'PaperText';

  const Button = ({ children, ...props }: any) => React.createElement('Button', props, children);
  Button.displayName = 'PaperButton';

  const Chip = ({ children, ...props }: any) => React.createElement('Chip', props, children);
  Chip.displayName = 'PaperChip';

  const TextInput = ({ ...props }: any) => React.createElement('TextInput', props);
  TextInput.displayName = 'PaperTextInput';

  const ActivityIndicator = (props: any) => React.createElement('ActivityIndicator', props);
  ActivityIndicator.displayName = 'PaperActivityIndicator';

  const Divider = (props: any) => React.createElement('Divider', props);
  Divider.displayName = 'PaperDivider';

  const Snackbar = ({ visible, children }: any) => (visible ? React.createElement(Text, null, children) : null);
  Snackbar.displayName = 'PaperSnackbar';

  const CardContent = createComponent('PaperCardContent');
  const CardActions = createComponent('PaperCardActions');

  const CardTitle = ({ title, subtitle }: any) =>
    React.createElement(View, null, [
      title ? React.createElement(Text, { key: 'title' }, title) : null,
      subtitle ? React.createElement(Text, { key: 'subtitle' }, subtitle) : null
    ]);
  CardTitle.displayName = 'PaperCardTitle';

  const Card = ({ children, ...props }: any) => React.createElement(View, props, children);
  Card.displayName = 'PaperCard';
  Card.Content = CardContent;
  Card.Actions = CardActions;
  Card.Title = CardTitle;

  return {
    __esModule: true as const,
    PaperProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    Card,
    Button,
    Chip,
    Text: TextComponent,
    TextInput,
    ActivityIndicator,
    Divider,
    Snackbar
  };
};

vi.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: vi.fn(async () => ({ granted: true })),
  requestMediaLibraryPermissionsAsync: vi.fn(async () => ({ granted: true })),
  launchCameraAsync: vi.fn(async () => ({ canceled: true, assets: [] })),
  MediaTypeOptions: { Images: 'Images' }
}));

vi.mock('react-native-paper', () => createPaperMock());

beforeAll(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({})
    }))
  );
});

afterEach(() => {
  vi.clearAllMocks();
});
