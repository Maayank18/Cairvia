permit (
  principal,
  action == Action::"READ_CONTEXT",
  resource
);

permit (
  principal,
  action == Action::"CREATE_TASK",
  resource
) when { context.userApproved == true };

permit (
  principal,
  action == Action::"WRITE_LOCAL",
  resource
) when { context.userApproved == true };

forbid (
  principal,
  action == Action::"SEND_EXTERNAL_MESSAGE",
  resource
);

forbid (
  principal,
  action == Action::"DELETE_DATA",
  resource
);
