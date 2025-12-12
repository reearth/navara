use std::collections::HashMap;

use bevy_ecs::event::{Event, EventReader, EventWriter};
use bevy_ecs::resource::Resource;
use bevy_ecs::system::{Res, ResMut};

use navara_math::{EqualEpsilon, FloatType, Vec2};
use navara_window::Window;

/// Epsilon threshold for detecting parallel finger movement in double swipe gestures.
/// A dot product within this range of 1.0 indicates nearly parallel vectors.
const PARALLEL_DOT_EPSILON: FloatType = 0.1;

/// Full rotation in degrees, used for angle normalization.
const FULL_ROTATION_DEGREES: FloatType = 360.0;

/// Half rotation in degrees, used for angle wrapping.
const HALF_ROTATION_DEGREES: FloatType = 180.0;

/// Represents the current state of a touch point.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TouchState {
    Start,
    End,
    Move,
}

/// Recognized touch gesture types for multi-touch interaction.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum TouchGesture {
    /// Single finger drag movement
    Swipe,
    /// Two finger parallel movement (typically for tilting)
    DoubleSwipe,
    /// Two fingers moving apart (zoom in)
    Spread,
    /// Two fingers moving together (zoom out)
    Pinch,
    /// Two finger rotation
    Rotate,
}

/// A tracked touch point with current and previous positions.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TouchPoint {
    pub position: Vec2,
    pub prev_position: Option<Vec2>,
}

/// Resource tracking all active touch points by their unique identifiers.
#[derive(Default, Debug, Clone, PartialEq, Resource)]
pub struct TouchList {
    pub touches: HashMap<i32, TouchPoint>,
}

/// Event representing raw touch input from the platform.
#[derive(Debug, Clone, PartialEq, Event)]
pub struct TouchInput {
    pub state: TouchState,
    pub position: Vec2,
    pub id: i32,
}

/// Event representing a recognized touch gesture with its delta.
#[derive(Debug, Clone, PartialEq, Event)]
pub struct TouchControl {
    pub gesture: TouchGesture,
    pub delta: Vec2,
}

/// Processes raw touch input events and emits recognized gesture events.
///
/// This system maintains the touch list state and performs gesture recognition
/// for single-finger swipes and two-finger gestures (pinch, spread, rotate, double swipe).
pub fn process_touch_input_events(
    mut ev: EventReader<TouchInput>,
    mut touch_list: ResMut<TouchList>,
    mut gesture_ev: EventWriter<TouchControl>,
    window: Res<Window>,
) {
    for touch in ev.read() {
        match touch.state {
            TouchState::Start | TouchState::Move => {
                let prev_position = touch_list
                    .touches
                    .get(&touch.id)
                    .map_or(touch.position, |t| t.position);

                let is_duplicate_position = prev_position == touch.position;

                if is_duplicate_position && touch.state == TouchState::Move {
                    continue;
                }

                touch_list.touches.insert(
                    touch.id,
                    TouchPoint {
                        position: touch.position,
                        prev_position: Some(prev_position),
                    },
                );
            }
            TouchState::End => {
                touch_list.touches.remove(&touch.id);
            }
        }

        if let Some(gesture) = recognize_gesture(&touch_list, &window) {
            gesture_ev.write(gesture);
        }
    }
}

/// Attempts to recognize a gesture from the current touch state.
///
/// Returns `Some(TouchControl)` if a gesture is recognized, `None` otherwise.
fn recognize_gesture(touch_list: &TouchList, window: &Window) -> Option<TouchControl> {
    match touch_list.touches.len() {
        2 => recognize_two_finger_gesture(touch_list, window),
        1 => recognize_single_finger_gesture(touch_list, window),
        _ => None,
    }
}

/// Recognizes gestures from two simultaneous touch points.
fn recognize_two_finger_gesture(touch_list: &TouchList, window: &Window) -> Option<TouchControl> {
    let mut touches = touch_list.touches.values();
    let p1 = touches.next()?;
    let p2 = touches.next()?;

    let gesture_candidates = GestureCandidates {
        double_swipe: recognize_double_swipe_gesture(p1, p2),
        rotate: recognize_rotate_gesture(p1, p2),
        spread_pinch: recognize_spread_pinch_gesture(p1, p2),
    };

    let dominant_gesture = gesture_candidates.disambiguate(p1, p2)?;

    let control = match dominant_gesture {
        TouchGesture::Rotate => TouchControl {
            gesture: TouchGesture::Rotate,
            delta: Vec2::new(
                gesture_candidates.rotate.unwrap_or(0.0) / FULL_ROTATION_DEGREES,
                0.0,
            ),
        },
        TouchGesture::Pinch | TouchGesture::Spread => TouchControl {
            gesture: dominant_gesture,
            delta: Vec2::splat(gesture_candidates.spread_pinch.unwrap_or(0.0)),
        },
        TouchGesture::DoubleSwipe => TouchControl {
            gesture: TouchGesture::DoubleSwipe,
            delta: Vec2::new(
                0.0,
                gesture_candidates.double_swipe.unwrap_or(0.0) / window.height as FloatType,
            ),
        },
        TouchGesture::Swipe => return None, // Not applicable for two fingers
    };

    Some(control)
}

/// Recognizes single finger swipe gesture.
fn recognize_single_finger_gesture(
    touch_list: &TouchList,
    window: &Window,
) -> Option<TouchControl> {
    let p = touch_list.touches.values().next()?;
    let delta = recognize_swipe_gesture(p)?;

    Some(TouchControl {
        gesture: TouchGesture::Swipe,
        delta: Vec2::new(
            delta.x / window.width as FloatType,
            delta.y / window.height as FloatType,
        ),
    })
}

/// Holds candidate gesture deltas for disambiguation.
struct GestureCandidates {
    rotate: Option<FloatType>,
    spread_pinch: Option<FloatType>,
    double_swipe: Option<FloatType>,
}

impl GestureCandidates {
    /// Determines the dominant gesture by comparing the magnitude of each gesture's delta.
    ///
    /// For rotation, we convert the angular delta to arc length (pixels) for fair comparison.
    /// The gesture with the largest magnitude wins.
    fn disambiguate(&self, p1: &TouchPoint, p2: &TouchPoint) -> Option<TouchGesture> {
        let rotate_magnitude = self.rotate.map(|degrees| {
            let circle_radius = (p1.position - p2.position).length();
            (degrees.to_radians() * circle_radius).abs()
        });

        let spread_pinch_magnitude = self.spread_pinch.map(|d| d.abs());
        let double_swipe_magnitude = self.double_swipe.map(|d| d.abs());

        // Find the gesture with maximum magnitude
        let mut max_magnitude = FloatType::NEG_INFINITY;
        let mut dominant = None;

        if let Some(mag) = rotate_magnitude {
            if mag > max_magnitude {
                max_magnitude = mag;
                dominant = Some(TouchGesture::Rotate);
            }
        }

        if let Some(mag) = spread_pinch_magnitude {
            if mag > max_magnitude {
                max_magnitude = mag;
                // Positive delta means prev_distance > current_distance (fingers moving together)
                dominant = if self.spread_pinch.unwrap_or(0.0) > 0.0 {
                    Some(TouchGesture::Pinch)
                } else {
                    Some(TouchGesture::Spread)
                };
            }
        }

        if let Some(mag) = double_swipe_magnitude {
            if mag > max_magnitude {
                dominant = Some(TouchGesture::DoubleSwipe);
            }
        }

        dominant
    }
}

/// Detects parallel two-finger swipe movement.
///
/// Returns the Y-axis delta if both fingers are moving in nearly the same direction.
fn recognize_double_swipe_gesture(p1: &TouchPoint, p2: &TouchPoint) -> Option<FloatType> {
    let p1_prev = p1.prev_position?;
    let p2_prev = p2.prev_position?;

    let p1_dir = (p1.position - p1_prev).normalize();
    let p2_dir = (p2.position - p2_prev).normalize();

    let dot = p1_dir.dot(p2_dir);

    // Both directions are almost parallel when cos(theta) ≈ 1.0
    if dot.equal_diff_epsilon(1.0, PARALLEL_DOT_EPSILON) {
        return Some(p1.position.y - p1_prev.y);
    }

    None
}

/// Detects pinch or spread gesture based on distance change between fingers.
///
/// Returns positive delta when fingers move together (pinch),
/// negative delta when fingers move apart (spread).
fn recognize_spread_pinch_gesture(p1: &TouchPoint, p2: &TouchPoint) -> Option<FloatType> {
    let p1_prev = p1.prev_position?;
    let p2_prev = p2.prev_position?;

    let prev_distance = (p1_prev - p2_prev).length();
    let current_distance = (p1.position - p2.position).length();

    // Only return a delta if there's actual movement
    if (current_distance - prev_distance).abs() > FloatType::EPSILON {
        return Some(prev_distance - current_distance);
    }

    None
}

/// Detects rotation gesture based on angular change between two touch points.
///
/// Returns the rotation delta in degrees, normalized to [-180, 180] range.
fn recognize_rotate_gesture(p1: &TouchPoint, p2: &TouchPoint) -> Option<FloatType> {
    let p1_prev = p1.prev_position?;
    let p2_prev = p2.prev_position?;

    let current_angle = (p1.position.y - p2.position.y).atan2(p1.position.x - p2.position.x);
    let prev_angle = (p1_prev.y - p2_prev.y).atan2(p1_prev.x - p2_prev.x);

    let mut delta = (current_angle - prev_angle).to_degrees();

    // Normalize to [-180, 180] range
    if delta > HALF_ROTATION_DEGREES {
        delta -= FULL_ROTATION_DEGREES;
    } else if delta < -HALF_ROTATION_DEGREES {
        delta += FULL_ROTATION_DEGREES;
    }

    Some(delta)
}

/// Detects single finger swipe movement.
///
/// Returns the position delta vector if there's a previous position to compare against.
fn recognize_swipe_gesture(p: &TouchPoint) -> Option<Vec2> {
    p.prev_position.map(|prev_pos| p.position - prev_pos)
}
