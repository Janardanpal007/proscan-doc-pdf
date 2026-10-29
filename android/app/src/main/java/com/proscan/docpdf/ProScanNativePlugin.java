package com.proscan.docpdf;

import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/** Device integration for ProScan: save to Downloads, share, print and open links. */
@CapacitorPlugin(name = "ProScanNative")
public class ProScanNativePlugin extends Plugin {

    private static String safeName(String name) {
        String n = name == null ? "file" : name.replaceAll("[\\\\/:*?\"<>|]", "_");
        return n.isEmpty() ? "file" : n;
    }

    private File writeTemp(String base64, String name) throws Exception {
        File dir = new File(getContext().getCacheDir(), "share");
        if (!dir.exists() && !dir.mkdirs()) throw new Exception("Cannot create cache folder");
        File f = new File(dir, safeName(name));
        try (OutputStream out = new FileOutputStream(f)) {
            out.write(Base64.decode(base64, Base64.DEFAULT));
        }
        return f;
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        String data = call.getString("data"), name = safeName(call.getString("name")), mime = call.getString("mime", "application/octet-stream");
        if (data == null) { call.reject("No data"); return; }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            String location;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/ProScan");
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);
                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new Exception("Could not create file in Downloads");
                try (OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) throw new Exception("Could not open file for writing");
                    out.write(bytes);
                }
                values.clear();
                values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
                location = "Downloads/ProScan";
            } else {
                // Older Android: app-specific Downloads folder needs no storage permission
                File dir = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "ProScan");
                if (!dir.exists() && !dir.mkdirs()) throw new Exception("Cannot create folder");
                File f = new File(dir, name);
                try (OutputStream out = new FileOutputStream(f)) { out.write(bytes); }
                location = f.getParent();
            }
            JSObject ret = new JSObject();
            ret.put("location", location);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Save failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void shareFile(PluginCall call) {
        try {
            File f = writeTemp(call.getString("data"), call.getString("name"));
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(call.getString("mime", "application/octet-stream"));
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_SUBJECT, f.getName());
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, "Share " + f.getName());
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject("Share failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void shareText(PluginCall call) {
        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        send.putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
        getActivity().startActivity(Intent.createChooser(send, "Share"));
        call.resolve();
    }

    @PluginMethod
    public void openUrl(PluginCall call) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(call.getString("url", "")));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(i);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("No app can open this link");
        }
    }

    @PluginMethod
    public void printPdf(PluginCall call) {
        final String jobName = call.getString("name", "ProScan document");
        final File f;
        try {
            f = writeTemp(call.getString("data"), safeName(jobName) + ".pdf");
        } catch (Exception e) {
            call.reject("Print failed: " + e.getMessage());
            return;
        }
        getActivity().runOnUiThread(() -> {
            PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            PrintDocumentAdapter adapter = new PrintDocumentAdapter() {
                @Override
                public void onLayout(PrintAttributes oldAttr, PrintAttributes newAttr, CancellationSignal cancel, LayoutResultCallback cb, Bundle extras) {
                    if (cancel.isCanceled()) { cb.onLayoutCancelled(); return; }
                    PrintDocumentInfo info = new PrintDocumentInfo.Builder(f.getName())
                        .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT).build();
                    cb.onLayoutFinished(info, true);
                }

                @Override
                public void onWrite(PageRange[] pages, ParcelFileDescriptor dest, CancellationSignal cancel, WriteResultCallback cb) {
                    try (InputStream in = new FileInputStream(f); OutputStream out = new FileOutputStream(dest.getFileDescriptor())) {
                        byte[] buf = new byte[16384];
                        int n;
                        while ((n = in.read(buf)) > 0) {
                            if (cancel.isCanceled()) { cb.onWriteCancelled(); return; }
                            out.write(buf, 0, n);
                        }
                        cb.onWriteFinished(new PageRange[] { PageRange.ALL_PAGES });
                    } catch (Exception e) {
                        cb.onWriteFailed(e.getMessage());
                    }
                }
            };
            pm.print(jobName, adapter, null);
            call.resolve();
        });
    }
}
