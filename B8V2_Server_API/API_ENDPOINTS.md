# API endpoints

## Auth
POST /api/auth/login
GET /api/auth/me

## Master
GET /api/master/departments
GET /api/master/users

## Roles
GET /api/roles
GET /api/roles/users/:userId
POST /api/roles/users/:userId
DELETE /api/roles/users/:userId/:roleCode

## Processes
GET /api/processes
POST /api/processes
GET /api/processes/my-documents
GET /api/processes/:id
POST /api/processes/:id/versions

## Process versions
GET /api/process-versions/:id
POST /api/process-versions/:id/submit
POST /api/process-versions/:id/review
POST /api/process-versions/:id/audiences
POST /api/process-versions/:id/publish
POST /api/process-versions/:id/view
POST /api/process-versions/:id/acknowledge

## Products
POST /api/products/upsert
GET /api/products/:itemCode

## Product documents
GET /api/product-documents
POST /api/product-documents
GET /api/product-documents/my/list
POST /api/product-documents/:id/itemcodes
POST /api/product-documents/:id/versions

## Product document versions
GET /api/product-document-versions/:id
POST /api/product-document-versions/:id/submit
POST /api/product-document-versions/:id/review
POST /api/product-document-versions/:id/audiences
POST /api/product-document-versions/:id/publish
POST /api/product-document-versions/:id/view

## File
POST /api/files/upload
POST /api/files/process-version/:versionId/:fileId
POST /api/files/product-document-version/:versionId/:fileId

## Feedback
POST /api/feedback/process/:versionId
POST /api/feedback/process/:feedbackId/resolve
POST /api/feedback/product/:versionId

## Dashboard
GET /api/dashboard
