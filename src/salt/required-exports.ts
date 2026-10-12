// SALT-23: every Salt export the product uses, in one list. `tsc --noEmit` fails here first if a name
// does not exist in the installed version. Names verified against @salt-ds/core 1.72.0 and
// @salt-ds/icons 1.18.3 (docs/salt-api-notes.md). Keep in sync as components are added.
import {
  SaltProviderNext, StackLayout, FlowLayout, GridLayout, SplitLayout, BorderLayout,
  H1, H2, H3, Text, Button, Input, FormField, FormFieldLabel, FormFieldHelperText,
  Checkbox, Switch, ToggleButtonGroup, ToggleButton, Card, InteractableCard, Banner, BannerContent,
  Dialog, DialogHeader, DialogContent, DialogActions, Tooltip, Spinner, Divider, Pill, Badge,
  StatusIndicator, Table, TBody, THead, TR, TH, TD, Stepper, Step, Tabs, TabBar, TabList, Tab, TabTrigger, TabPanel, BannerActions,
  LinearProgress, FileDropZone, FileDropZoneIcon, FileDropZoneTrigger, useAriaAnnouncer, AriaAnnouncerProvider,
} from "@salt-ds/core";
import {
  CheckmarkIcon, CloseIcon, ErrorIcon, WarningIcon, InfoIcon, UploadIcon, DownloadIcon, ArrowRightIcon, CopyIcon,
} from "@salt-ds/icons";

export const required = {
  SaltProviderNext, StackLayout, FlowLayout, GridLayout, SplitLayout, BorderLayout,
  H1, H2, H3, Text, Button, Input, FormField, FormFieldLabel, FormFieldHelperText,
  Checkbox, Switch, ToggleButtonGroup, ToggleButton, Card, InteractableCard, Banner, BannerContent,
  Dialog, DialogHeader, DialogContent, DialogActions, Tooltip, Spinner, Divider, Pill, Badge,
  StatusIndicator, Table, TBody, THead, TR, TH, TD, Stepper, Step, Tabs, TabBar, TabList, Tab, TabTrigger, TabPanel, BannerActions,
  LinearProgress, FileDropZone, FileDropZoneIcon, FileDropZoneTrigger, useAriaAnnouncer, AriaAnnouncerProvider,
  CheckmarkIcon, CloseIcon, ErrorIcon, WarningIcon, InfoIcon, UploadIcon, DownloadIcon, ArrowRightIcon, CopyIcon,
};
