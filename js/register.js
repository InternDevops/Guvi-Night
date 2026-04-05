/**
 * register.js
 * Handles user registration via jQuery AJAX.
 * No form submission — pure AJAX calls to Python backend.
 */

$(function () {

  var API_BASE = 'https://guvi-night.onrender.com';   // Python Flask backend

  /* ── Helpers ── */
  function showAlert(type, icon, message) {
    var html =
      '<div class="alert-custom alert-' + type + '">' +
        '<i class="bi bi-' + icon + '"></i> ' + message +
      '</div>';
    $('#alertArea').html(html);
  }

  function clearAlert() {
    $('#alertArea').empty();
  }

  function setLoading(isLoading) {
    var $btn = $('#submitBtn');
    if (isLoading) {
      $btn.prop('disabled', true).html('<span class="spinner"></span>Creating account…');
    } else {
      $btn.prop('disabled', false).html('Create account');
    }
  }

  function validateField($input) {
    var isValid = $input[0].checkValidity();
    $input.toggleClass('is-invalid', !isValid);
    return isValid;
  }

  function passwordsMatch() {
    var pwd  = $('#password').val();
    var conf = $('#confirmPassword').val();
    var match = pwd === conf && conf.length > 0;
    $('#confirmPassword').toggleClass('is-invalid', !match);
    return match;
  }

  /* ── Live validation ── */
  $('#registerForm input').on('blur', function () {
    validateField($(this));
  });

  $('#confirmPassword').on('input', function () {
    passwordsMatch();
  });

  /* ── Password toggle ── */
  $('.toggle-password').on('click', function () {
    var $input = $('#password');
    var $icon  = $('#toggleIcon');
    if ($input.attr('type') === 'password') {
      $input.attr('type', 'text');
      $icon.removeClass('bi-eye').addClass('bi-eye-slash');
    } else {
      $input.attr('type', 'password');
      $icon.removeClass('bi-eye-slash').addClass('bi-eye');
    }
  });

  /* ── Form Submit ── */
  $('#registerForm').on('submit', function (e) {
    e.preventDefault();
    clearAlert();

    // Validate all fields
    var allValid = true;
    $(this).find('input[required]').each(function () {
      if (!validateField($(this))) allValid = false;
    });

    if (!passwordsMatch()) {
      allValid = false;
      showAlert('error', 'x-circle', 'Passwords do not match.');
      return;
    }

    if (!allValid) {
      showAlert('error', 'x-circle', 'Please fix the highlighted fields.');
      return;
    }

    var payload = {
      first_name: $.trim($('#firstName').val()),
      last_name:  $.trim($('#lastName').val()),
      email:      $.trim($('#email').val()),
      username:   $.trim($('#username').val()),
      password:   $('#password').val()
    };

    setLoading(true);

    $.ajax({
      url:         API_BASE + '/api/register',
      type:        'POST',
      contentType: 'application/json',
      data:        JSON.stringify(payload),
      dataType:    'json',

      success: function (response) {
        setLoading(false);
        if (response.success) {
          showAlert('success', 'check-circle', 'Account created! Redirecting to login…');
          setTimeout(function () {
            window.location.href = 'login.html';
          }, 1500);
        } else {
          showAlert('error', 'x-circle', response.message || 'Registration failed.');
        }
      },

      error: function (xhr) {
        setLoading(false);
        var msg = 'Server error. Please try again.';
        try {
          var resp = JSON.parse(xhr.responseText);
          if (resp.message) msg = resp.message;
        } catch (err) { /* ignore */ }
        showAlert('error', 'exclamation-triangle', msg);
      }
    });
  });

});
