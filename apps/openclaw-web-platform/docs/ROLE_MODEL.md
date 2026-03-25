# Role Model

## Roles

- `guest`
- `user`
- `reviewer`
- `super_admin`

## Permissions

### guest
- browse public product pages
- browse published official/community packages

### user
- authenticate
- create drafts
- submit packages
- view own submissions
- download published packages

### reviewer
- view review queue
- request changes
- approve
- reject
- publish reviewed content
- no access to admin settings, audit logs, cloud access code management, or runtime operations

### super_admin
- includes all reviewer capabilities
- manage users and roles
- manage security configuration
- force unpublish / archive
- access full audit logs
- manage cloud access codes
- manage runtime / local compute / cloud operations

## Constraints

- reviewers cannot change super-admin security settings
- super-admin must be a separately seeded high-trust account
- admin 2FA policy only applies to `super_admin`
- admin 2FA can be enabled or disabled from the auth-email policy settings; default is enabled
