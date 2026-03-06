import React from 'react';
import TimesheetForm from '../components/TimesheetForm';
import TimesheetTable from '../components/TimesheetTable';
import Layout from './Layout'; // We'll create this

const TimesheetsPage = () => {
  return (
    <Layout title="Timesheets">
      <div className="mb-8">
        <TimesheetForm />
      </div>
      <TimesheetTable />
    </Layout>
  );
};

export default TimesheetsPage;