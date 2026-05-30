defmodule GrupYorumHalktirPhoenixWeb.PlayerLive do
  use GrupYorumHalktirPhoenixWeb, :live_view

  alias GrupYorumHalktirPhoenix.Music
  alias GrupYorumHalktirPhoenixWeb.SEO.JsonLd
  alias Jason

  @brand "Grup Yorum Halktır"
  @site_url "https://grupyorum.mulayim.app"
  @home_og_image "https://grupyorumr2.mulayim.app/albums/1987-siyrilip-gelen/cover.jpg"
  @home_description "Grup Yorum'un tüm albümlerine ve şarkılarına özgürce erişin. Sansüre ve erişim engellemelerine karşı direnişin sesi."

  @impl true
  def mount(_params, _session, socket) do
    # No DB work here beyond the cheap cached album list. socket.id is unstable
    # (changes between HTTP mount, WS mount, and reconnects), so any
    # playback_state lookup keyed on it would create orphan rows. Real state is
    # loaded by the "set-session-id" handler, which the JS hook fires immediately
    # after WS connect with a stable ID from localStorage.
    #
    # Selection (selected_album/tracks/current_track) is filled by handle_params/3,
    # which runs after mount on every navigation including the initial dead render.
    albums = Music.list_albums()
    session_id = socket.id

    socket =
      socket
      |> assign(:albums, albums)
      |> assign(:selected_album, nil)
      |> assign(:tracks, [])
      |> assign(:current_track, nil)
      |> assign(:deep_linked?, false)
      # Flips to true once the page is interactive (set-session-id fires on WS
      # connect). Gates click-to-play: in-app navigation to a track autoplays,
      # the initial/deep-link load only cues.
      |> assign(:can_autoplay?, false)
      |> assign(:track_durations, %{})
      |> assign(:player_state, %{
        position: 0.0,
        volume: 1.0,
        is_playing: false,
        shuffle_enabled: false,
        duration: nil,
        played_track_ids: []
      })
      |> assign(:mobile_view, :albums)
      |> assign(:session_id, session_id)
      |> assign(:initial_session_id, session_id)
      |> assign_home_seo()

    {:ok, socket}
  end

  @impl true
  def handle_params(%{"slug" => slug, "track_slug" => track_slug}, _uri, socket) do
    # Track URL: /album/:slug/:track_slug
    album = Music.get_album_by_slug!(slug)
    track = Music.get_track_by_slug!(slug, track_slug)
    tracks = Music.list_tracks_by_album(album.id)

    socket =
      socket
      |> select_album_assigns(album, tracks)
      |> assign(:deep_linked?, true)
      |> assign(:mobile_view, :tracks)
      |> assign_track_seo(album, track)

    # Clicking a track row is an in-app navigation (after the page is
    # interactive): the click is a user gesture, so play immediately. On the
    # initial load / deep link there is no gesture yet — just cue it paused
    # (the browser would block autoplay anyway, and set-session-id keeps it).
    socket =
      if socket.assigns.can_autoplay?,
        do: start_playback(socket, track),
        else: cue_track(socket, track)

    {:noreply, socket}
  rescue
    # Unknown album/track slug: redirect home instead of a 404.
    Ecto.NoResultsError -> {:noreply, redirect(socket, to: ~p"/")}
  end

  def handle_params(%{"slug" => slug}, _uri, socket) do
    # Album URL: /album/:slug
    album = Music.get_album_by_slug!(slug)
    tracks = Music.list_tracks_by_album(album.id)

    socket =
      socket
      # Do NOT touch :current_track here — browsing to an album must keep the
      # currently-playing track (and its <audio> src) intact, otherwise the
      # player stops and the now-playing bar vanishes.
      |> select_album_assigns(album, tracks)
      |> assign(:deep_linked?, true)
      |> assign(:mobile_view, :tracks)
      |> assign_album_seo(album)

    {:noreply, socket}
  rescue
    # Unknown album slug: redirect home instead of a 404.
    Ecto.NoResultsError -> {:noreply, redirect(socket, to: ~p"/")}
  end

  def handle_params(_params, _uri, socket) do
    # Home: keep UX parity by pre-selecting the first album's tracks, but DO NOT
    # cue a track and DO NOT mark this as a deep link (so set-session-id may
    # restore the previous session freely).
    albums = socket.assigns.albums
    selected_album = List.first(albums)
    tracks = if selected_album, do: Music.list_tracks_by_album(selected_album.id), else: []

    socket =
      socket
      # Do NOT touch :current_track here — navigating home must keep the
      # currently-playing track (and its <audio> src) intact.
      |> select_album_assigns(selected_album, tracks)
      |> assign(:deep_linked?, false)
      |> assign(:mobile_view, :albums)
      |> assign_home_seo()

    {:noreply, socket}
  end

  @impl true
  def handle_event("select-album", %{"album-id" => album_id}, socket) do
    album = Music.get_album!(String.to_integer(album_id))
    tracks = Music.list_tracks_by_album(album.id)

    # Use existing durations first (from localStorage/previous albums), then query DB only for missing ones
    existing_durations = socket.assigns.track_durations || %{}

    tracks_missing_durations =
      tracks
      |> Enum.filter(fn track -> not Map.has_key?(existing_durations, track.id) end)

    # Query database only for tracks missing durations
    db_durations =
      tracks_missing_durations
      |> Enum.filter(fn track -> not is_nil(track.duration) end)
      |> Enum.map(fn track -> {track.id, track.duration} end)
      |> Map.new()

    # Merge: existing durations first, database fills gaps
    track_durations = Map.merge(existing_durations, db_durations)

    socket =
      socket
      |> assign(:selected_album, album)
      |> assign(:tracks, tracks)
      |> assign(:track_durations, track_durations)
      |> assign(:mobile_view, :tracks)
      |> update(:player_state, fn state ->
        # Reset played tracks when switching albums (fresh start for new album)
        %{state | played_track_ids: []}
      end)
      |> push_event("umami-track", %{
        eventName: "Album Selected: #{album.title}",
        eventData: %{
          album_id: album.id,
          album_title: album.title,
          album_year: album.year,
          track_count: length(tracks)
        }
      })

    {:noreply, socket}
  end

  @impl true
  def handle_event("load-track-durations", %{"durations" => durations}, socket) do
    # Merge localStorage durations with existing DB durations
    # DB is source of truth (once ANY user discovers, ALL users see), localStorage is performance cache
    durations_map =
      durations
      |> Enum.map(fn {track_id_str, duration} ->
        track_id = String.to_integer(track_id_str)
        {track_id, duration}
      end)
      |> Map.new()

    # Merge: DB durations (existing) take precedence, localStorage fills gaps
    # This way DB (discovered by any user) is always shown, localStorage just optimizes
    merged_durations = Map.merge(durations_map, socket.assigns.track_durations)

    {:noreply, assign(socket, :track_durations, merged_durations)}
  end

  @impl true
  def handle_event("set-session-id", %{"session_id" => stable_session_id}, socket) do
    # Update to use the stable session ID from localStorage
    playback_state = Music.get_or_create_playback_state(stable_session_id)

    deep_linked? = socket.assigns.deep_linked?

    # Restore current track if exists.
    # When deep-linked (URL pinned an album/track), keep what handle_params set —
    # do NOT let the saved session overwrite the URL-addressed selection.
    current_track =
      cond do
        deep_linked? -> socket.assigns.current_track
        playback_state.current_track_id -> Music.get_track!(playback_state.current_track_id)
        true -> socket.assigns.current_track
      end

    # Update selected album if we have a current track (but never override a deep link)
    selected_album =
      cond do
        deep_linked? -> socket.assigns.selected_album
        current_track -> current_track.album
        true -> socket.assigns.selected_album
      end

    tracks =
      if selected_album,
        do: Music.list_tracks_by_album(selected_album.id),
        else: socket.assigns.tracks

    # Use localStorage durations first (fast!), then query DB only for missing ones
    # localStorage will be loaded via load-track-durations event from JS hook
    # For now, just query DB for tracks missing from existing track_durations
    existing_durations = socket.assigns.track_durations || %{}

    tracks_missing_durations =
      tracks
      |> Enum.filter(fn track -> not Map.has_key?(existing_durations, track.id) end)

    # Query database only for tracks missing durations
    db_durations =
      tracks_missing_durations
      |> Enum.filter(fn track -> not is_nil(track.duration) end)
      |> Enum.map(fn track -> {track.id, track.duration} end)
      |> Map.new()

    # Merge: existing durations first, database fills gaps
    track_durations = Map.merge(existing_durations, db_durations)

    # Restore duration for current track if it exists
    restored_duration =
      if current_track do
        current_track.duration || Map.get(track_durations, current_track.id)
      else
        nil
      end

    # Restore the saved position only when the selected track (from the URL or
    # the session) is the same one the position was saved against — otherwise 0.
    restored_position =
      if current_track && playback_state.current_track_id == current_track.id do
        playback_state.position || 0.0
      else
        0.0
      end

    socket =
      socket
      |> assign(:session_id, stable_session_id)
      # Page is now interactive — subsequent track navigations may autoplay.
      |> assign(:can_autoplay?, true)
      |> assign(:current_track, current_track)
      |> assign(:selected_album, selected_album)
      |> assign(:tracks, tracks)
      |> assign(:track_durations, track_durations)
      |> assign(:player_state, %{
        position: restored_position,
        # Store slider value (0-1)
        volume: playback_state.volume || socket.assigns.player_state.volume,
        # Always reset to false after refresh since we don't autoplay
        is_playing: false,
        shuffle_enabled: playback_state.shuffle_enabled || false,
        duration: restored_duration,
        # Reset played tracks on session restore
        played_track_ids: []
      })
      |> then(fn s ->
        # Convert slider value to audio volume and set it (always — both paths).
        audio_volume = slider_to_audio_volume(s.assigns.player_state.volume)
        s = push_event(s, "set-volume", %{volume: audio_volume})

        # Restore the audio source/position so a refresh resumes where it left off.
        cond do
          is_nil(current_track) ->
            s

          # Deep link: cue_track already set the src for the URL track, so a second
          # set-src would be a no-op (same src). Seek it to the restored position.
          deep_linked? ->
            if restored_position > 0.0,
              do: push_event(s, "seek", %{position: restored_position}),
              else: s

          # Session restore: set the src and seek to the saved position.
          true ->
            push_event(s, "set-src", %{src: current_track.file_url, position: restored_position})
        end
      end)

    {:noreply, socket}
  end

  @impl true
  def handle_event("back-to-albums", _params, socket) do
    socket =
      socket
      |> assign(:mobile_view, :albums)
      |> push_event("umami-track", %{
        eventName:
          if(socket.assigns.selected_album,
            do: "Back to Albums: #{socket.assigns.selected_album.title}",
            else: "Back to Albums"
          ),
        eventData: %{
          album_id:
            if(socket.assigns.selected_album, do: socket.assigns.selected_album.id, else: nil),
          album_title:
            if(socket.assigns.selected_album, do: socket.assigns.selected_album.title, else: nil)
        }
      })

    {:noreply, socket}
  end

  @impl true
  def handle_event("play-track", %{"track-id" => track_id}, socket) do
    track = Music.get_track!(String.to_integer(track_id))
    {:noreply, start_playback(socket, track)}
  end

  @impl true
  def handle_event("play-pause", _params, socket) do
    # Don't allow play if no track is selected
    if is_nil(socket.assigns.current_track) do
      {:noreply, socket}
    else
      new_playing_state = !socket.assigns.player_state.is_playing

      socket =
        socket
        |> update(:player_state, fn state -> %{state | is_playing: new_playing_state} end)
        |> then(fn s ->
          if new_playing_state do
            # If we're starting playback, seek to saved position first, then play
            saved_position = s.assigns.player_state.position || 0.0

            s
            |> push_event("seek-and-play", %{position: saved_position})
          else
            push_event(s, "pause", %{})
          end
        end)
        |> push_event("umami-track", %{
          eventName:
            "#{if(new_playing_state, do: "Play", else: "Pause")}: #{socket.assigns.current_track.title}",
          eventData: %{
            action: if(new_playing_state, do: "play", else: "pause"),
            track_id: socket.assigns.current_track.id,
            track_title: socket.assigns.current_track.title,
            position: socket.assigns.player_state.position || 0.0
          }
        })

      # Save playback state
      Music.update_playback_state(socket.assigns.session_id, %{
        is_playing: new_playing_state
      })

      {:noreply, socket}
    end
  end

  @impl true
  def handle_event("next", _params, socket) do
    if socket.assigns.current_track do
      played_track_ids = socket.assigns.player_state.played_track_ids || []

      next_track =
        Music.get_next_track(
          socket.assigns.current_track,
          socket.assigns.tracks,
          socket.assigns.player_state.shuffle_enabled,
          played_track_ids
        )

      # Get duration from database or track_durations map
      initial_duration =
        next_track.duration || Map.get(socket.assigns.track_durations, next_track.id)

      # Add next track to played list if shuffle is enabled and not already played
      new_played_track_ids =
        if socket.assigns.player_state.shuffle_enabled do
          if next_track.id in played_track_ids do
            played_track_ids
          else
            [next_track.id | played_track_ids]
          end
        else
          played_track_ids
        end

      # Check if all tracks have been played (for shuffle mode)
      # If so, reset the list (already handled in Music.get_next_track, but reset here too)
      final_played_track_ids =
        if socket.assigns.player_state.shuffle_enabled do
          available_tracks =
            Enum.reject(socket.assigns.tracks, fn t -> t.id in new_played_track_ids end)

          if Enum.empty?(available_tracks) do
            # Reset when all tracks played
            []
          else
            new_played_track_ids
          end
        else
          new_played_track_ids
        end

      socket =
        socket
        |> assign(:current_track, next_track)
        |> update(:player_state, fn state ->
          %{
            state
            | is_playing: true,
              position: 0.0,
              duration: initial_duration,
              played_track_ids: final_played_track_ids
          }
        end)
        |> push_event("set-src", %{src: next_track.file_url})
        |> push_event("play", %{})
        |> push_event("umami-track", %{
          eventName: "Next Track: #{next_track.title}",
          eventData: %{
            previous_track_id: socket.assigns.current_track.id,
            previous_track_title: socket.assigns.current_track.title,
            next_track_id: next_track.id,
            next_track_title: next_track.title,
            shuffle_enabled: socket.assigns.player_state.shuffle_enabled
          }
        })

      # Save playback state
      Music.update_playback_state(socket.assigns.session_id, %{
        current_track_id: next_track.id,
        is_playing: true,
        position: 0.0
      })

      {:noreply, socket}
    else
      {:noreply, socket}
    end
  end

  @impl true
  def handle_event("previous", _params, socket) do
    if socket.assigns.current_track do
      played_track_ids = socket.assigns.player_state.played_track_ids || []

      previous_track =
        Music.get_previous_track(
          socket.assigns.current_track,
          socket.assigns.tracks,
          socket.assigns.player_state.shuffle_enabled,
          played_track_ids
        )

      # Get duration from database or track_durations map
      initial_duration =
        previous_track.duration || Map.get(socket.assigns.track_durations, previous_track.id)

      # Add previous track to played list if shuffle is enabled and not already played
      new_played_track_ids =
        if socket.assigns.player_state.shuffle_enabled do
          if previous_track.id in played_track_ids do
            played_track_ids
          else
            [previous_track.id | played_track_ids]
          end
        else
          played_track_ids
        end

      # Check if all tracks have been played (for shuffle mode)
      final_played_track_ids =
        if socket.assigns.player_state.shuffle_enabled do
          available_tracks =
            Enum.reject(socket.assigns.tracks, fn t -> t.id in new_played_track_ids end)

          if Enum.empty?(available_tracks) do
            # Reset when all tracks played
            []
          else
            new_played_track_ids
          end
        else
          new_played_track_ids
        end

      socket =
        socket
        |> assign(:current_track, previous_track)
        |> update(:player_state, fn state ->
          %{
            state
            | is_playing: true,
              position: 0.0,
              duration: initial_duration,
              played_track_ids: final_played_track_ids
          }
        end)
        |> push_event("set-src", %{src: previous_track.file_url})
        |> push_event("play", %{})
        |> push_event("umami-track", %{
          eventName: "Previous Track: #{previous_track.title}",
          eventData: %{
            previous_track_id: socket.assigns.current_track.id,
            previous_track_title: socket.assigns.current_track.title,
            next_track_id: previous_track.id,
            next_track_title: previous_track.title,
            shuffle_enabled: socket.assigns.player_state.shuffle_enabled
          }
        })

      # Save playback state
      Music.update_playback_state(socket.assigns.session_id, %{
        current_track_id: previous_track.id,
        is_playing: true,
        position: 0.0
      })

      {:noreply, socket}
    else
      {:noreply, socket}
    end
  end

  @impl true
  def handle_event("seek", %{"position" => position}, socket) do
    position_float =
      case position do
        pos when is_float(pos) -> pos
        pos when is_integer(pos) -> pos * 1.0
        pos when is_binary(pos) -> String.to_float(pos)
        _ -> 0.0
      end

    socket =
      socket
      |> update(:player_state, fn state -> %{state | position: position_float} end)
      |> push_event("seek", %{position: position_float})
      |> then(fn s ->
        if s.assigns.current_track do
          push_event(s, "umami-track", %{
            eventName: "Seek: #{s.assigns.current_track.title}",
            eventData: %{
              track_id: s.assigns.current_track.id,
              track_title: s.assigns.current_track.title,
              position: position_float,
              duration: s.assigns.player_state.duration
            }
          })
        else
          s
        end
      end)

    # Save playback state
    if socket.assigns.current_track do
      Music.update_playback_state(socket.assigns.session_id, %{
        position: position_float
      })
    end

    {:noreply, socket}
  end

  @impl true
  def handle_event("volume-change", %{"volume" => volume}, socket) do
    # Volume comes as slider value (0-1), we store it as-is
    # The JavaScript hook converts it to actual audio volume using quadratic curve
    volume_float =
      case volume do
        vol when is_float(vol) ->
          vol

        vol when is_integer(vol) ->
          vol * 1.0

        vol when is_binary(vol) ->
          case Float.parse(vol) do
            {val, _} -> val
            :error -> 1.0
          end

        _ ->
          1.0
      end
      |> clamp_volume()

    # Convert slider value to actual audio volume for the audio element
    # Using quadratic curve: audioVolume = sliderValue^2
    audio_volume = :math.pow(volume_float, 2)

    socket =
      socket
      |> update(:player_state, fn state -> %{state | volume: volume_float} end)
      |> push_event("set-volume", %{volume: audio_volume})

    # Save playback state (store slider value, not audio volume)
    Music.update_playback_state(socket.assigns.session_id, %{
      volume: volume_float
    })

    {:noreply, socket}
  end

  @impl true
  def handle_event("toggle-shuffle", _params, socket) do
    new_shuffle_state = !socket.assigns.player_state.shuffle_enabled

    # Reset played tracks when toggling shuffle (fresh start)
    socket =
      socket
      |> update(:player_state, fn state ->
        %{state | shuffle_enabled: new_shuffle_state, played_track_ids: []}
      end)
      |> push_event("umami-track", %{
        eventName:
          if(socket.assigns.current_track,
            do:
              "Shuffle #{if(new_shuffle_state, do: "On", else: "Off")}: #{socket.assigns.current_track.title}",
            else: "Shuffle #{if(new_shuffle_state, do: "On", else: "Off")}"
          ),
        eventData: %{
          shuffle_enabled: new_shuffle_state,
          current_track_id:
            if(socket.assigns.current_track, do: socket.assigns.current_track.id, else: nil),
          current_track_title:
            if(socket.assigns.current_track, do: socket.assigns.current_track.title, else: nil)
        }
      })

    # Save playback state
    Music.update_playback_state(socket.assigns.session_id, %{
      shuffle_enabled: new_shuffle_state
    })

    {:noreply, socket}
  end

  @impl true
  def handle_event("audio-duration", %{"duration" => duration, "track_id" => track_id}, socket) do
    duration_float =
      case duration do
        dur when is_float(dur) ->
          dur

        dur when is_integer(dur) ->
          dur * 1.0

        dur when is_binary(dur) ->
          case Float.parse(dur) do
            {val, _} -> val
            :error -> nil
          end

        _ ->
          nil
      end

    track_id_int =
      case track_id do
        id when is_integer(id) -> id
        id when is_binary(id) -> String.to_integer(id)
        _ -> nil
      end

    if duration_float && track_id_int do
      # Only update if this is the current track
      if socket.assigns.current_track && socket.assigns.current_track.id == track_id_int do
        # Save duration to database if track doesn't have one
        track = Music.get_track!(track_id_int)

        if is_nil(track.duration) do
          Music.update_track_duration(track_id_int, duration_float)
        end

        # Store duration for this track in socket state
        track_durations = Map.put(socket.assigns.track_durations, track_id_int, duration_float)

        socket =
          socket
          |> assign(:track_durations, track_durations)
          |> update(:player_state, fn state -> %{state | duration: duration_float} end)

        {:noreply, socket}
      else
        # Track changed, just save to database and track_durations
        track = Music.get_track!(track_id_int)

        if is_nil(track.duration) do
          Music.update_track_duration(track_id_int, duration_float)
        end

        track_durations = Map.put(socket.assigns.track_durations, track_id_int, duration_float)
        {:noreply, assign(socket, :track_durations, track_durations)}
      end
    else
      {:noreply, socket}
    end
  end

  @impl true
  def handle_event("audio-timeupdate", %{"current-time" => current_time}, socket) do
    time_float =
      case current_time do
        time when is_float(time) ->
          time

        time when is_integer(time) ->
          time * 1.0

        time when is_binary(time) ->
          case Float.parse(time) do
            {val, _} -> val
            :error -> 0.0
          end

        _ ->
          0.0
      end

    # Save position periodically (but not too frequently to avoid spam)
    # Only save if position changed significantly (more than 1 second)
    should_save =
      socket.assigns.player_state.position == nil ||
        abs(socket.assigns.player_state.position - time_float) > 1.0

    socket =
      socket
      |> update(:player_state, fn state -> %{state | position: time_float} end)
      |> then(fn s ->
        if should_save && s.assigns.current_track do
          # Save to database (but don't block)
          Task.start(fn ->
            Music.update_playback_state(s.assigns.session_id, %{
              position: time_float
            })
          end)

          s
        else
          s
        end
      end)

    {:noreply, socket}
  end

  @impl true
  def handle_event("audio-ended", _params, socket) do
    if socket.assigns.current_track do
      # Capture before assigning next track
      completed_track = socket.assigns.current_track
      played_track_ids = socket.assigns.player_state.played_track_ids || []

      next_track =
        Music.get_next_track(
          completed_track,
          socket.assigns.tracks,
          socket.assigns.player_state.shuffle_enabled,
          played_track_ids
        )

      # Get duration from database or track_durations map
      initial_duration =
        next_track.duration || Map.get(socket.assigns.track_durations, next_track.id)

      # Add next track to played list if shuffle is enabled and not already played
      new_played_track_ids =
        if socket.assigns.player_state.shuffle_enabled do
          if next_track.id in played_track_ids do
            played_track_ids
          else
            [next_track.id | played_track_ids]
          end
        else
          played_track_ids
        end

      # Check if all tracks have been played (for shuffle mode)
      final_played_track_ids =
        if socket.assigns.player_state.shuffle_enabled do
          available_tracks =
            Enum.reject(socket.assigns.tracks, fn t -> t.id in new_played_track_ids end)

          if Enum.empty?(available_tracks) do
            # Reset when all tracks played
            []
          else
            new_played_track_ids
          end
        else
          new_played_track_ids
        end

      socket =
        socket
        |> assign(:current_track, next_track)
        |> update(:player_state, fn state ->
          %{
            state
            | is_playing: true,
              position: 0.0,
              duration: initial_duration,
              played_track_ids: final_played_track_ids
          }
        end)
        |> push_event("set-src", %{src: next_track.file_url})
        |> push_event("play", %{})
        |> push_event("umami-track", %{
          eventName: "Track Completed: #{completed_track.title}",
          eventData: %{
            completed_track_id: completed_track.id,
            completed_track_title: completed_track.title,
            next_track_id: next_track.id,
            next_track_title: next_track.title,
            shuffle_enabled: socket.assigns.player_state.shuffle_enabled
          }
        })
        |> push_event("umami-track", %{
          eventName: "Track Played: #{next_track.title}",
          eventData: %{
            track_id: next_track.id,
            track_title: next_track.title,
            album_id: next_track.album.id,
            album_title: next_track.album.title,
            track_number: next_track.track_number,
            shuffle_enabled: socket.assigns.player_state.shuffle_enabled,
            auto_advanced: true
          }
        })

      # Save playback state
      Music.update_playback_state(socket.assigns.session_id, %{
        current_track_id: next_track.id,
        is_playing: true,
        position: 0.0
      })

      {:noreply, socket}
    else
      {:noreply, update(socket, :player_state, fn state -> %{state | is_playing: false} end)}
    end
  end

  #
  # Selection / cueing helpers (used by handle_params)
  #

  # Selects an album and its tracks, merging DB durations into the existing
  # duration cache exactly like the "select-album" handler. Nil-safe: a nil
  # album leaves tracks empty and clears the selection.
  defp select_album_assigns(socket, nil, _tracks) do
    socket
    |> assign(:selected_album, nil)
    |> assign(:tracks, [])
    |> update(:player_state, fn state -> %{state | played_track_ids: []} end)
  end

  defp select_album_assigns(socket, album, tracks) do
    existing_durations = socket.assigns.track_durations || %{}

    db_durations =
      tracks
      |> Enum.filter(fn track -> not Map.has_key?(existing_durations, track.id) end)
      |> Enum.filter(fn track -> not is_nil(track.duration) end)
      |> Enum.map(fn track -> {track.id, track.duration} end)
      |> Map.new()

    track_durations = Map.merge(existing_durations, db_durations)

    socket
    |> assign(:selected_album, album)
    |> assign(:tracks, tracks)
    |> assign(:track_durations, track_durations)
    |> update(:player_state, fn state -> %{state | played_track_ids: []} end)
  end

  # Cues a track without autoplay: sets it as current, resets position, sets
  # duration from the DB/cache, and pushes set-src (NEVER "play" — autoplay needs
  # a user gesture). Clicking a track navigates here; the user can then press play.
  defp cue_track(socket, track) do
    initial_duration = track.duration || Map.get(socket.assigns.track_durations, track.id)

    socket
    |> assign(:current_track, track)
    |> update(:player_state, fn state ->
      %{state | is_playing: false, position: 0.0, duration: initial_duration}
    end)
    |> push_event("set-src", %{src: track.file_url})
  end

  # Starts playback of a track: marks it current + playing, pushes set-src +
  # play, records it for shuffle, and persists the playback state. Shared by the
  # "play-track" event and in-app navigation to a track URL (handle_params).
  defp start_playback(socket, track) do
    initial_duration = track.duration || Map.get(socket.assigns.track_durations, track.id)

    played_track_ids =
      if socket.assigns.player_state.shuffle_enabled do
        ids = socket.assigns.player_state.played_track_ids || []
        if track.id in ids, do: ids, else: [track.id | ids]
      else
        socket.assigns.player_state.played_track_ids || []
      end

    Music.update_playback_state(socket.assigns.session_id, %{
      current_track_id: track.id,
      is_playing: true,
      position: 0.0
    })

    socket
    |> assign(:current_track, track)
    |> update(:player_state, fn state ->
      %{
        state
        | is_playing: true,
          position: 0.0,
          duration: initial_duration,
          played_track_ids: played_track_ids
      }
    end)
    |> push_event("set-src", %{src: track.file_url})
    |> push_event("play", %{})
    |> push_event("umami-track", %{
      eventName: "Track Played: #{track.title}",
      eventData: %{
        track_id: track.id,
        track_title: track.title,
        album_id: track.album.id,
        album_title: track.album.title,
        track_number: track.track_number,
        shuffle_enabled: socket.assigns.player_state.shuffle_enabled
      }
    })
  end

  #
  # SEO assigns (read by root.html.heex on the dead render)
  #

  defp assign_home_seo(socket) do
    socket
    |> assign(:page_title, nil)
    |> assign(:meta_description, @home_description)
    |> assign(:canonical_url, @site_url <> "/")
    |> assign(:og_image, @home_og_image)
    |> assign(:og_type, "website")
    |> assign(:json_ld, JsonLd.home(socket.assigns.albums))
  end

  defp assign_album_seo(socket, album) do
    socket
    |> assign(:page_title, album.title)
    |> assign(:meta_description, album_description(album))
    |> assign(:canonical_url, @site_url <> ~p"/album/#{album.slug}")
    |> assign(:og_image, album.cover_url)
    |> assign(:og_type, "music.album")
    |> assign(:json_ld, JsonLd.album(album, socket.assigns.tracks))
  end

  defp assign_track_seo(socket, album, track) do
    socket
    |> assign(:page_title, "#{track.title} - #{album.title}")
    |> assign(:meta_description, track_description(album, track))
    |> assign(:canonical_url, @site_url <> ~p"/album/#{album.slug}/#{track.slug}")
    |> assign(:og_image, album.cover_url)
    |> assign(:og_type, "music.song")
    |> assign(:json_ld, JsonLd.track(album, track, socket.assigns.tracks))
  end

  defp album_description(%{description: desc}) when is_binary(desc) and desc != "", do: desc

  defp album_description(album) do
    year = if album.year, do: " (#{album.year})", else: ""
    "Grup Yorum'un #{album.title}#{year} albümü. Tüm şarkıları #{@brand}'da dinleyin."
  end

  defp track_description(album, track) do
    "#{track.title} — Grup Yorum'un #{album.title} albümünden. #{@brand}'da dinleyin."
  end

  defp clamp_volume(volume) when volume < 0.0, do: 0.0
  defp clamp_volume(volume) when volume > 1.0, do: 1.0
  defp clamp_volume(volume), do: volume

  # Convert slider value (0-1) to actual audio volume using quadratic curve
  # This gives better control at lower volumes
  defp slider_to_audio_volume(slider_value) when is_float(slider_value) do
    :math.pow(slider_value, 2)
  end

  defp slider_to_audio_volume(slider_value) when is_integer(slider_value) do
    slider_to_audio_volume(slider_value * 1.0)
  end

  defp slider_to_audio_volume(_), do: 1.0

  # Helper function for template to convert slider value to audio volume
  def audio_volume_from_slider(slider_value) do
    slider_to_audio_volume(slider_value)
  end

  def format_time(seconds) when is_float(seconds) or is_integer(seconds) do
    total_seconds = trunc(seconds)
    minutes = div(total_seconds, 60)
    secs = rem(total_seconds, 60)
    "#{minutes}:#{String.pad_leading(Integer.to_string(secs), 2, "0")}"
  end

  def format_time(_), do: "0:00"

  attr :tracks, :list, required: true
  attr :current_track, :any, default: nil
  attr :player_state, :map, required: true
  attr :track_durations, :map, required: true
  attr :album_slug, :string, default: nil
  attr :id, :string, default: "tracks-list"

  defp tracks_list(assigns) do
    # Prepare tracks data for JavaScript hook (only id and file_url needed)
    tracks_data =
      assigns.tracks
      |> Enum.map(fn track -> %{id: track.id, file_url: track.file_url} end)
      |> Jason.encode!()

    # Prepare known durations for JavaScript hook (so it can skip preloading)
    known_durations =
      assigns.track_durations
      |> Enum.map(fn {track_id, duration} -> {track_id, duration} end)
      |> Map.new()
      |> Jason.encode!()

    assigns =
      assigns
      |> assign(:tracks_data, tracks_data)
      |> assign(:known_durations, known_durations)

    ~H"""
    <div
      id={@id}
      class="p-4 lg:p-6"
      phx-hook="TrackListPreloader"
      data-tracks={@tracks_data}
      data-known-durations={@known_durations}
    >
      <div class="space-y-0.5">
        <.link
          :for={track <- @tracks}
          patch={~p"/album/#{@album_slug}/#{track.slug}"}
          class={[
            "group flex items-center gap-4 px-3 py-2.5 rounded-md cursor-pointer transition-all",
            if(@current_track && track.id == @current_track.id,
              do: "bg-base-200/50",
              else: "hover:bg-base-200/30"
            )
          ]}
        >
          <div class="w-8 text-center text-sm text-base-content/50 group-hover:text-base-content/70 transition-colors">
            <%= if @current_track && track.id == @current_track.id do %>
              <.icon
                name="lucide-music"
                class={"w-6 h-6 text-neutral-content mx-auto #{if @player_state.is_playing, do: "animate-pulse", else: ""}"}
              />
            <% else %>
              {track.track_number}
            <% end %>
          </div>
          <div class="flex-1 min-w-0 flex items-center justify-between gap-4">
            <p class={[
              "text-sm truncate transition-colors",
              if(@current_track && track.id == @current_track.id,
                do: "font-medium text-base-content",
                else: "text-base-content/70 group-hover:text-base-content/90"
              )
            ]}>
              {track.title}
            </p>
            <div
              class="text-xs text-base-content/50 group-hover:text-base-content/60 min-w-[50px] sm:min-w-[70px] text-right transition-colors shrink-0"
              data-track-time={track.id}
              data-track-id={track.id}
            >
              <%= if @current_track && track.id == @current_track.id do %>
                <span data-track-current-time={track.id}>
                  {format_time(@player_state.position)}
                </span>
                <span class="text-base-content/40"> / </span>
                <span data-track-duration={track.id}>
                  {if @player_state.duration, do: format_time(@player_state.duration), else: "--:--"}
                </span>
              <% else %>
                <%= if duration = Map.get(@track_durations, track.id) do %>
                  {format_time(duration)}
                <% else %>
                  --:--
                <% end %>
              <% end %>
            </div>
          </div>
        </.link>
      </div>
    </div>
    """
  end
end
