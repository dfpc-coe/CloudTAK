package io.cloudtak.app;

import android.database.Cursor;
import android.database.MatrixCursor;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract.Document;
import android.provider.DocumentsContract.Root;
import android.provider.DocumentsProvider;
import android.webkit.MimeTypeMap;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;

/**
 * Read-only view of the offline overlays directory in the system Files app
 */
public class OverlaysProvider extends DocumentsProvider {

    private static final String DIRECTORY = "Overlays";
    private static final String ROOT_ID = "overlays";

    private static final String[] ROOT_PROJECTION = {
        Root.COLUMN_ROOT_ID,
        Root.COLUMN_DOCUMENT_ID,
        Root.COLUMN_TITLE,
        Root.COLUMN_SUMMARY,
        Root.COLUMN_ICON,
        Root.COLUMN_FLAGS,
        Root.COLUMN_AVAILABLE_BYTES
    };

    private static final String[] DOCUMENT_PROJECTION = {
        Document.COLUMN_DOCUMENT_ID,
        Document.COLUMN_DISPLAY_NAME,
        Document.COLUMN_MIME_TYPE,
        Document.COLUMN_LAST_MODIFIED,
        Document.COLUMN_SIZE,
        Document.COLUMN_FLAGS
    };

    @Override
    public boolean onCreate() {
        return true;
    }

    private File root() throws FileNotFoundException {
        File base = getContext().getExternalFilesDir(null);
        if (base == null) throw new FileNotFoundException("External storage is unavailable");

        File root = new File(base, DIRECTORY);
        if (!root.isDirectory() && !root.mkdirs()) throw new FileNotFoundException("Overlays directory is unavailable");

        return root;
    }

    private String documentId(File file) throws FileNotFoundException {
        String rootPath = root().getAbsolutePath();
        String path = file.getAbsolutePath();

        return path.equals(rootPath) ? ROOT_ID : ROOT_ID + path.substring(rootPath.length());
    }

    private File file(String documentId) throws FileNotFoundException {
        File root = root();
        if (ROOT_ID.equals(documentId)) return root;
        if (!documentId.startsWith(ROOT_ID + "/")) throw new FileNotFoundException(documentId);

        File file = new File(root, documentId.substring(ROOT_ID.length() + 1));

        try {
            if (!file.getCanonicalPath().startsWith(root.getCanonicalPath() + File.separator)) {
                throw new FileNotFoundException(documentId);
            }
        } catch (IOException err) {
            throw new FileNotFoundException(documentId);
        }

        if (!file.exists()) throw new FileNotFoundException(documentId);

        return file;
    }

    private static String mimeType(File file) {
        if (file.isDirectory()) return Document.MIME_TYPE_DIR;

        String name = file.getName();
        int dot = name.lastIndexOf('.');
        String mime = dot < 0 ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(name.substring(dot + 1).toLowerCase());

        return mime != null ? mime : "application/octet-stream";
    }

    private void include(MatrixCursor cursor, File file) throws FileNotFoundException {
        cursor
            .newRow()
            .add(Document.COLUMN_DOCUMENT_ID, documentId(file))
            .add(Document.COLUMN_DISPLAY_NAME, file.getName())
            .add(Document.COLUMN_MIME_TYPE, mimeType(file))
            .add(Document.COLUMN_LAST_MODIFIED, file.lastModified())
            .add(Document.COLUMN_SIZE, file.length())
            .add(Document.COLUMN_FLAGS, 0);
    }

    @Override
    public Cursor queryRoots(String[] projection) throws FileNotFoundException {
        MatrixCursor cursor = new MatrixCursor(projection != null ? projection : ROOT_PROJECTION);
        File root = root();

        cursor
            .newRow()
            .add(Root.COLUMN_ROOT_ID, ROOT_ID)
            .add(Root.COLUMN_DOCUMENT_ID, ROOT_ID)
            .add(Root.COLUMN_TITLE, getContext().getString(R.string.app_name))
            .add(Root.COLUMN_SUMMARY, DIRECTORY)
            .add(Root.COLUMN_ICON, R.mipmap.ic_launcher)
            .add(Root.COLUMN_FLAGS, Root.FLAG_LOCAL_ONLY)
            .add(Root.COLUMN_AVAILABLE_BYTES, root.getFreeSpace());

        return cursor;
    }

    @Override
    public Cursor queryDocument(String documentId, String[] projection) throws FileNotFoundException {
        MatrixCursor cursor = new MatrixCursor(projection != null ? projection : DOCUMENT_PROJECTION);
        include(cursor, file(documentId));
        return cursor;
    }

    @Override
    public Cursor queryChildDocuments(String parentDocumentId, String[] projection, String sortOrder) throws FileNotFoundException {
        MatrixCursor cursor = new MatrixCursor(projection != null ? projection : DOCUMENT_PROJECTION);

        File[] children = file(parentDocumentId).listFiles();
        if (children != null) {
            for (File child : children) include(cursor, child);
        }

        return cursor;
    }

    @Override
    public boolean isChildDocument(String parentDocumentId, String documentId) {
        return documentId.startsWith(parentDocumentId + "/");
    }

    @Override
    public ParcelFileDescriptor openDocument(String documentId, String mode, CancellationSignal signal) throws FileNotFoundException {
        if (!"r".equals(mode)) throw new FileNotFoundException("Overlays are read-only");

        return ParcelFileDescriptor.open(file(documentId), ParcelFileDescriptor.MODE_READ_ONLY);
    }
}
