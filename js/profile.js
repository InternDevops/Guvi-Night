/**
 * profile.js
 * - Guards page (redirect if not logged in).
 * - Loads profile data from MongoDB via AJAX.
 * - Updates profile details via AJAX.
 * - Logout clears localStorage and calls /api/logout.
 */

$(function () {

  var API_BASE = 'http://localhost:5000';

  /* ── Session Guard ── */
  var sessionRaw = localStorage.getItem('nexus_session');
  if (!sessionRaw) {
    window.location.replace('login.html');
    return;
  }

  var session;
  try { session = JSON.parse(sessionRaw); }
  catch (e) {
    localStorage.removeItem('nexus_session');
    window.location.replace('login.html');
    return;
  }

  var token = session.token;

  /* ── UI Helpers ── */
  function showAlert(type, icon, message) {
    var html =
      '<div class="alert-custom alert-' + type + '">' +
        '<i class="bi bi-' + icon + '"></i> ' + message +
      '</div>';
    $('#alertArea').html(html);
    setTimeout(function () { $('#alertArea').empty(); }, 4000);
  }

  function setInitials(name) {
    var parts = name.trim().split(' ');
    var initials = parts.map(function (p) { return p[0] || ''; }).slice(0, 2).join('').toUpperCase();
    $('#navAvatar, #avatarLarge').text(initials || '?');
  }

  function setSaveLoading(isLoading) {
    var $btn = $('#saveBtn');
    if (isLoading) {
      $btn.prop('disabled', true).html('<span class="spinner"></span>Saving…');
    } else {
      $btn.prop('disabled', false).html('<i class="bi bi-cloud-upload me-1"></i> Save changes');
    }
  }

  /* ── Populate navbar from localStorage ── */
  var fullName = (session.first_name || '') + ' ' + (session.last_name || '');
  fullName = fullName.trim() || session.username || 'User';
  $('#navUsername').text(session.username || 'User');
  $('#profileFullName').text(fullName);
  $('#profileEmail').text(session.email || '');
  $('#statUsername').text('@' + (session.username || '—'));
  setInitials(fullName);

  /* ── Load Profile from MongoDB ── */
  function loadProfile() {
    $.ajax({
      url:     API_BASE + '/api/profile',
      type:    'GET',
      headers: { 'Authorization': 'Bearer ' + token },
      dataType: 'json',

      success: function (response) {
        if (response.success && response.profile) {
          var p = response.profile;
          $('#age').val(p.age || '');
          $('#dob').val(p.dob || '');
          $('#contact').val(p.contact || '');
          $('#gender').val(p.gender || '');
          $('#address').val(p.address || '');
          $('#bio').val(p.bio || '');
          $('#occupation').val(p.occupation || '');
          $('#website').val(p.website || '');

          // Joined date
          if (p.created_at) {
            var d = new Date(p.created_at);
            $('#statJoined').text(d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }));
          }
        }
      },

      error: function (xhr) {
        if (xhr.status === 401) {
          // Token expired or invalid
          doLogout(false);
        }
      }
    });
  }

  loadProfile();

  /* ── Save Profile ── */
  $('#profileForm').on('submit', function (e) {
    e.preventDefault();

    var payload = {
      age:        $('#age').val()        ? parseInt($('#age').val(), 10) : null,
      dob:        $('#dob').val()        || null,
      contact:    $.trim($('#contact').val())    || null,
      gender:     $('#gender').val()     || null,
      address:    $.trim($('#address').val())    || null,
      bio:        $.trim($('#bio').val())        || null,
      occupation: $.trim($('#occupation').val()) || null,
      website:    $.trim($('#website').val())    || null
    };

    setSaveLoading(true);

    $.ajax({
      url:         API_BASE + '/api/profile',
      type:        'PUT',
      contentType: 'application/json',
      headers:     { 'Authorization': 'Bearer ' + token },
      data:        JSON.stringify(payload),
      dataType:    'json',

      success: function (response) {
        setSaveLoading(false);
        if (response.success) {
          showAlert('success', 'check-circle', 'Profile updated successfully!');
        } else {
          showAlert('error', 'x-circle', response.message || 'Update failed.');
        }
      },

      error: function (xhr) {
        setSaveLoading(false);
        var msg = 'Server error. Please try again.';
        try {
          var resp = JSON.parse(xhr.responseText);
          if (resp.message) msg = resp.message;
        } catch (err) { /* ignore */ }
        if (xhr.status === 401) { doLogout(false); return; }
        showAlert('error', 'exclamation-triangle', msg);
      }
    });
  });

  /* ── Logout ── */
  function doLogout(callApi) {
    if (callApi === undefined) callApi = true;

    function finish() {
      localStorage.removeItem('nexus_session');
      window.location.replace('login.html');
    }

    if (callApi) {
      $.ajax({
        url:     API_BASE + '/api/logout',
        type:    'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        dataType: 'json',
        complete: finish   // always redirect, even on error
      });
    } else {
      finish();
    }
  }

  $('#logoutBtn').on('click', function () {
    doLogout(true);
  });

});
