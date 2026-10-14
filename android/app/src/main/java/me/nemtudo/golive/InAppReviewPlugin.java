package me.nemtudo.golive;

import android.app.Activity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.review.ReviewInfo;
import com.google.android.play.core.review.ReviewManager;
import com.google.android.play.core.review.ReviewManagerFactory;

/**
 * Google Play's in-app review sheet — see lib/appReview.ts for when it is
 * asked for.
 *
 * <p>Play decides whether the sheet actually shows (it has its own quota per
 * person), and never says whether it did or what was rated. So {@link
 * #request} resolving means "asked", nothing more, and the site must not
 * treat it as a review having happened.
 */
@CapacitorPlugin(name = "InAppReview")
public class InAppReviewPlugin extends Plugin {

    @PluginMethod
    public void request(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("No activity");
            return;
        }
        ReviewManager manager = ReviewManagerFactory.create(activity);
        manager.requestReviewFlow().addOnCompleteListener(task -> {
            if (!task.isSuccessful()) {
                // No Play Store on the device, or Play said no. Not an error
                // anyone can act on.
                call.reject("Review flow unavailable");
                return;
            }
            ReviewInfo info = task.getResult();
            manager.launchReviewFlow(activity, info).addOnCompleteListener(done -> call.resolve());
        });
    }
}
