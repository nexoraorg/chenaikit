# Modal and Dialog System Documentation

## Overview

This document provides comprehensive guidance for using the Modal and Dialog system in the Chenaikit frontend application. The system provides four main components:

1. **Modal** - Base modal component with customizable content and actions
2. **Dialog** - Simple dialog for messages and confirmations
3. **ConfirmDialog** - Specialized dialog for confirmation flows
4. **FormModal** - Multi-step form wizard with validation

## Architecture

### ModalContext

The `ModalContext` provides a global state management solution for modals. It allows you to open, close, and manage modals from anywhere in your application without prop drilling.

```typescript
interface ModalConfig {
  id: string;
  title?: string;
  content: React.ReactNode;
  actions?: Array<{
    label: string;
    onClick: () => void | Promise<void>;
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
  }>;
  size?: 'small' | 'medium' | 'large' | 'full';
  open: boolean;
  onClose: () => void;
  disableBackdropClick?: boolean;
  disableEscapeKey?: boolean;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  className?: string;
}
```

### Accessibility Features

All modal components include comprehensive accessibility features:

- **ARIA Attributes**: Proper labeling with `aria-labelledby` and `aria-describedby`
- **Focus Trapping**: Uses `focus-trap-react` to ensure focus stays within modal
- **Keyboard Navigation**: Supports Escape key to close (configurable)
- **Screen Reader Support**: Semantic HTML structure for screen readers
- **Backdrop Control**: Backdrop click to close is configurable

### Animation and Styling

- **Smooth Transitions**: 300ms enter, 200ms exit transitions
- **Material-UI Integration**: Uses MUI Dialog as foundation
- **Responsive Design**: Adapts to mobile and desktop views
- **Theme Support**: Full Material-UI theme integration

## Components

### 1. Modal Component

The base modal component with customizable content, title, and actions.

#### Features
- Custom content and title
- Action buttons with variants
- Size options (small, medium, large, full)
- Focus trapping
- Backdrop and escape key close options
- Smooth animations
- Responsive design

#### Usage

```typescript
import Modal from '@/components/Modal';

function MyComponent() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Open Modal</button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Welcome"
        content="This is a modal!"
        size="medium"
        actions={[
          {
            label: 'Cancel',
            onClick: () => setOpen(false),
            variant: 'secondary',
          },
          {
            label: 'Confirm',
            onClick: () => {
              console.log('Confirmed!');
              setOpen(false);
            },
            variant: 'primary',
          },
        ]}
      />
    </>
  );
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| open | boolean | - | Whether modal is open |
| onClose | () => void | - | Callback when modal closes |
| title | string | - | Modal title |
| content | React.ReactNode | - | Modal content |
| actions | Array | - | Action buttons |
| size | 'small' \| 'medium' \| 'large' \| 'full' | 'medium' | Modal size |
| maxWidth | 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' | 'md' | Dialog max width |
| fullWidth | boolean | true | Whether modal takes full width |
| disableBackdropClick | boolean | false | Disable closing on backdrop click |
| disableEscapeKey | boolean | false | Disable closing on escape key |
| className | string | - | Custom CSS class |

### 2. Dialog Component

Simplified dialog for messages, alerts, and confirmations with icon support.

#### Features
- Message-focused interface
- Icon support for different types (info, warning, success, error)
- Type-specific styling
- Custom icons supported
- Action buttons
- Compact design

#### Usage

```typescript
import DialogComponent from '@/components/Dialog';

function MyComponent() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Show Info</button>
      <DialogComponent
        open={open}
        onClose={() => setOpen(false)}
        title="Important Notice"
        message="This is an important message for you."
        type="info"
        actions={[
          {
            label: 'Got it',
            onClick: () => setOpen(false),
            variant: 'primary',
          },
        ]}
      />
    </>
  );
}
```

#### Dialog Types

```typescript
type DialogType = 'info' | 'warning' | 'success' | 'error';
```

Each type has corresponding icon and color styling.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| open | boolean | - | Whether dialog is open |
| onClose | () => void | - | Callback when dialog closes |
| title | string | - | Dialog title |
| message | React.ReactNode | - | Dialog message |
| type | DialogType | 'info' | Dialog type determines icon and color |
| icon | React.ReactNode | - | Custom icon (overrides type icon) |
| actions | Array | - | Action buttons |
| maxWidth | 'xs' \| 'sm' \| 'md' | 'sm' | Dialog max width |
| disableBackdropClick | boolean | false | Disable closing on backdrop click |
| disableEscapeKey | boolean | false | Disable closing on escape key |

### 3. ConfirmDialog Component

Specialized component for confirmation workflows with optional confirmation text input.

#### Features
- Pre-built confirm/cancel buttons
- Optional confirmation text input (e.g., "Are you sure? Type DELETE to confirm")
- Danger mode with warning styling
- Loading state
- Callback handlers for confirm and cancel
- Focus management

#### Usage

```typescript
import ConfirmDialog from '@/components/ConfirmDialog';

function DeleteUser() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await deleteUserAPI();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)}>Delete Account</button>
      <ConfirmDialog
        open={open}
        onConfirm={handleDelete}
        onCancel={() => setOpen(false)}
        title="Delete Account"
        message="This action cannot be undone. All your data will be permanently deleted."
        isDangerous={true}
        isLoading={loading}
        requireConfirmation={true}
        confirmationText="DELETE"
        confirmLabel="Delete Account"
        cancelLabel="Keep Account"
      />
    </>
  );
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| open | boolean | - | Whether dialog is open |
| onConfirm | () => void \| Promise<void> | - | Callback on confirm |
| onCancel | () => void | - | Callback on cancel |
| title | string | - | Dialog title |
| message | React.ReactNode | - | Dialog message |
| isDangerous | boolean | false | Shows warning styling for destructive actions |
| isLoading | boolean | false | Disables buttons during async operation |
| requireConfirmation | boolean | false | Shows confirmation text input |
| confirmationText | string | '' | Text user must type to confirm |
| confirmLabel | string | 'Confirm' | Confirm button label |
| cancelLabel | string | 'Cancel' | Cancel button label |
| disableBackdropClick | boolean | false | Disable closing on backdrop click |
| disableEscapeKey | boolean | false | Disable closing on escape key |

### 4. FormModal Component

Multi-step form wizard with validation, progress tracking, and lifecycle hooks.

#### Features
- Multiple steps with validation
- Progress indicator and stepper
- Previous/Next navigation
- Step lifecycle hooks (onNext, onPrevious)
- Size variants
- Loading state
- Focus management

#### FormStep Interface

```typescript
interface FormStep {
  label: string;
  component: React.ReactNode;
  validation?: () => boolean;
  onNext?: () => void | Promise<void>;
  onPrevious?: () => void | Promise<void>;
}
```

#### Usage

```typescript
import FormModal, { FormStep } from '@/components/FormModal';
import { useState } from 'react';

function SignupWizard() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });

  const steps: FormStep[] = [
    {
      label: 'Account Information',
      component: (
        <div>
          <input
            type="email"
            placeholder="Email"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />
        </div>
      ),
      validation: () => formData.email.includes('@'),
    },
    {
      label: 'Password',
      component: (
        <div>
          <input
            type="password"
            placeholder="Password"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
          />
          <input
            type="password"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
            onChange={(e) =>
              setFormData({ ...formData, confirmPassword: e.target.value })
            }
          />
        </div>
      ),
      validation: () =>
        formData.password && formData.password === formData.confirmPassword,
    },
    {
      label: 'Review',
      component: (
        <div>
          <p>Email: {formData.email}</p>
          <p>Ready to create account?</p>
        </div>
      ),
    },
  ];

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await signupAPI(formData);
      setOpen(false);
      setFormData({ email: '', password: '', confirmPassword: '' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)}>Sign Up</button>
      <FormModal
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={handleSubmit}
        title="Create Account"
        steps={steps}
        isLoading={loading}
        showProgress={true}
        size="medium"
      />
    </>
  );
}
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| open | boolean | - | Whether modal is open |
| onClose | () => void | - | Callback when modal closes |
| onSubmit | (data?: any) => void \| Promise<void> | - | Callback on form submission |
| title | string | - | Modal title |
| steps | FormStep[] | - | Array of form steps |
| isLoading | boolean | false | Disables buttons during async operation |
| showProgress | boolean | true | Shows progress indicator and stepper |
| size | 'small' \| 'medium' \| 'large' | 'medium' | Modal size |
| disableBackdropClick | boolean | false | Disable closing on backdrop click |
| disableEscapeKey | boolean | false | Disable closing on escape key |
| allowSkipSteps | boolean | false | Allow skipping steps |

## Using ModalContext for Global Modal Management

For advanced use cases, use the `ModalContext` to manage modals globally:

```typescript
import { ModalProvider, useModal } from '@/contexts/ModalContext';
import Modal from '@/components/Modal';

// In your app root:
function App() {
  return (
    <ModalProvider>
      <YourApp />
    </ModalProvider>
  );
}

// Use modals anywhere:
function MyComponent() {
  const { openModal, closeModal } = useModal();

  const handleOpenModal = () => {
    const id = openModal({
      title: 'Notification',
      content: 'This is a global modal!',
      actions: [
        {
          label: 'Close',
          onClick: () => closeModal(id),
          variant: 'primary',
        },
      ],
    });
  };

  return (
    <>
      <button onClick={handleOpenModal}>Open Modal</button>
      {/* Modal will be rendered by ModalProvider */}
    </>
  );
}
```

## Best Practices

1. **Always set proper sizes** for different content types
2. **Use type-appropriate dialogs** (Dialog for simple messages, FormModal for forms)
3. **Provide clear action labels** (Confirm, Delete, Save, etc.)
4. **Use isDangerous flag** for destructive actions
5. **Implement validation** in FormModal steps
6. **Handle async operations** with loading states
7. **Test keyboard navigation** and screen reader compatibility
8. **Use ARIA labels** for complex content
9. **Prevent backdrop click** for critical operations
10. **Provide focus management** with autoFocus

## Testing

All components include comprehensive unit tests. Run tests with:

```bash
npm test -- Modal.test.tsx
npm test -- Dialog.test.tsx
npm test -- ConfirmDialog.test.tsx
npm test -- FormModal.test.tsx
```

## Accessibility Checklist

- [ ] Modal has proper title (aria-labelledby)
- [ ] Content is labeled (aria-describedby)
- [ ] Focus is trapped within modal
- [ ] Escape key closes modal (unless disabled)
- [ ] All buttons are keyboard accessible
- [ ] Color alone is not used to convey meaning
- [ ] Sufficient contrast ratios (WCAG AA)
- [ ] Screen reader announces modal opening/closing
- [ ] Form labels are associated with inputs

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Dependencies

- `@mui/material` (^5.15.0)
- `@emotion/react` (^11.11.0)
- `@emotion/styled` (^11.11.0)
- `focus-trap-react` (latest)
- `react` (^18.0.0)

## Performance Considerations

- Modals use React.memo internally (via MUI)
- Focus trap is only active when modal is open
- Event listeners are cleaned up on unmount
- Animations use CSS transitions (GPU accelerated)
- No memory leaks with proper cleanup

## Future Enhancements

- [ ] Nested modal support
- [ ] Modal queue management
- [ ] Custom animation presets
- [ ] Modal persistence (remember open state)
- [ ] Advanced layout options
- [ ] Drag-and-drop support for modals
- [ ] Modal resize capability
