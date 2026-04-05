/**
 * login.js
 * Handles user login via jQuery AJAX.
 * Session stored in localStorage (key: nexus_session).
 */

$(function () {

  var API_BASE = 'http://localhost:5000';

  /* ── Redirect if already logged in ── */
  if (localStorage.getItem('nexus_session')) {
    window.location.replace('profile.html');
    return;
  }

  /* ── Helpers ── */
  function showAlert(type, icon, message) {
    var html =
      '<div class="alert-custom alert-' + type + '">' +
        '<i class="bi bi-' + icon + '"></i> ' + message +
      '</div>';
    $('#alertArea').html(html);
  }

  function clearAlert() { $('#alertArea').empty(); }

  function setLoading(isLoading) {
    var $btn = $('#submitBtn');
    if (isLoading) {
      $btn.prop('disabled', true).html('<span class="spinner"></span>Signing in…');
    } else {
      $btn.prop('disabled', false).html('Sign in');
    }
  }

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

  /* ── Live validation ── */
  $('#loginForm input').on('blur', function () {
    if (!this.checkValidity()) {
      $(this).addClass('is-invalid');
    } else {
      $(this).removeClass('is-invalid');
    }
  });

  /* ── Form Submit ── */
  $('#loginForm').on('submit', function (e) {
    e.preventDefault();
    clearAlert();

    var identifier = $.trim($('#identifier').val());
    var password   = $('#password').val();

    if (!identifier || !password) {
      showAlert('error', 'x-circle', 'Please fill in all fields.');
      $('#identifier, #password').each(function () {
        if (!$(this).val()) $(this).addClass('is-invalid');
      });
      return;
    }

    var payload = {
      identifier: identifier,
      password:   password,
      remember:   $('#rememberMe').is(':checked')
    };

    setLoading(true);

    $.ajax({
      url:         API_BASE + '/api/login',
      type:        'POST',
      contentType: 'application/json',
      data:        JSON.stringify(payload),
      dataType:    'json',

      success: function (response) {
        setLoading(false);

        if (response.success) {
          /* Store session token + user info in localStorage */
          var sessionData = {
            token:      response.token,
            user_id:    response.user.id,
            username:   response.user.username,
            email:      response.user.email,
            first_name: response.user.first_name,
            last_name:  response.user.last_name,
            logged_at:  new Date().toISOString()
          };

          localStorage.setItem('nexus_session', JSON.stringify(sessionData));

          showAlert('success', 'check-circle', 'Login successful! Redirecting…');
          setTimeout(function () {
            window.location.href = 'profile.html';
          }, 1000);
        } else {
          showAlert('error', 'lock', response.message || 'Invalid credentials.');
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
