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

### super_admin
- manage users and roles
- manage security configuration
- force unpublish / archive
- access full audit logs

## Constraints

- reviewers cannot change super-admin security settings
- super-admin must be a separately seeded high-trust account
