import { createRequire } from 'module';
import React from 'react';
import renderer from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { View, Text } = require('react-native');

vi.mock('react-native-paper', () => {
  const createComponent = (displayName) => {
    const Component = ({ children, ...props }) => React.createElement(View, props, children);
    Component.displayName = displayName;
    return Component;
  };

  const TextComponent = ({ children, ...props }) => React.createElement(Text, props, children);
  TextComponent.displayName = 'PaperText';

  const Button = ({ children, ...props }) => React.createElement('Button', props, children);
  Button.displayName = 'PaperButton';

  const Chip = ({ children, ...props }) => React.createElement('Chip', props, children);
  Chip.displayName = 'PaperChip';

  const TextInput = (props) => React.createElement('TextInput', props);
  TextInput.displayName = 'PaperTextInput';

  const ActivityIndicator = (props) => React.createElement('ActivityIndicator', props);
  ActivityIndicator.displayName = 'PaperActivityIndicator';

  const Divider = (props) => React.createElement('Divider', props);
  Divider.displayName = 'PaperDivider';

  const Snackbar = ({ visible, children }) => (visible ? React.createElement(Text, null, children) : null);
  Snackbar.displayName = 'PaperSnackbar';

  const CardContent = createComponent('PaperCardContent');
  const CardActions = createComponent('PaperCardActions');

  const CardTitle = ({ title, subtitle }) =>
    React.createElement(View, null, [
      title ? React.createElement(Text, { key: 'title' }, title) : null,
      subtitle ? React.createElement(Text, { key: 'subtitle' }, subtitle) : null
    ]);
  CardTitle.displayName = 'PaperCardTitle';

  const Card = ({ children, ...props }) => React.createElement(View, props, children);
  Card.displayName = 'PaperCard';
  Card.Content = CardContent;
  Card.Actions = CardActions;
  Card.Title = CardTitle;

  return {
    __esModule: true,
    PaperProvider: ({ children }) => React.createElement(React.Fragment, null, children),
    Card,
    Button,
    Chip,
    Text: TextComponent,
    TextInput,
    ActivityIndicator,
    Divider,
    Snackbar
  };
});

describe('Driver Dashboard', () => {
  it('renders login card by default', () => {
    const DriverDashboard = require('../app/index').default;
    const { PaperProvider } = require('react-native-paper');

    const tree = renderer.create(
      <PaperProvider>
        <DriverDashboard />
      </PaperProvider>
    );

    const titleNodes = tree.root.findAll(
      node => typeof node.props?.title === 'string' && node.props.title.includes('外送員登入')
    );

    expect(titleNodes.length).toBeGreaterThan(0);
  });
});
