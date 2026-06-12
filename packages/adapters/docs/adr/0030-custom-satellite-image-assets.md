# Custom Satellite images use separate binary assets

Custom Satellite instance JSON persists only stable image asset IDs. Image bytes live in a dedicated SQLite BLOB table and are loaded on demand for visible image fields.

The persistence adapter validates the declared MIME type, file signature, and 5 MB limit before atomically storing the asset and updating its instance field. Replacing or clearing an image and deleting an instance remove unreferenced assets. Legacy embedded `data:` URLs are migrated during adapter startup.

This keeps normal hydration and unrelated Satellite mutations proportional to structured state size instead of total image size while retaining local, transactional persistence.
