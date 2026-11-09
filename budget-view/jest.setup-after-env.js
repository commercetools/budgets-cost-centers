// Connect builds the view with the classic JSX runtime, so the tests do too. React 19 warns once about that runtime
// in development; the warning is expected here and silenced through the Merchant Center preset. [BCC-DEPLOY-10]
global.console.config.addSilencedWarning(/outdated JSX transform/);
