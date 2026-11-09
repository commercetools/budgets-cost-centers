// The Custom View renders the budget panel; the shell already checks the view permission. [BCC-VIEW-1]
import React from 'react';
import BudgetPanel from './components/budget-panel';

const ApplicationRoutes = () => <BudgetPanel />;
ApplicationRoutes.displayName = 'ApplicationRoutes';

export default ApplicationRoutes;
